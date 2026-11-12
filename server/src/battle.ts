import { randomBytes, randomInt } from 'node:crypto';
import type { IncomingMessage, Server } from 'node:http';
import { URL } from 'node:url';
import { WebSocket, WebSocketServer, type RawData } from 'ws';
import { cleanPlayerName } from '../../src/shop/types';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 5;
const GRID_SIZE = 10;
const TICKET_TTL_MS = 30_000;
const ROOM_TTL_MS = 30 * 60_000;
const MAX_ROOMS = 500;
const MAX_SCORE = 10_000_000;

interface Player {
  id: string;
  name: string;
}

interface Ticket extends Player {
  expiresAt: number;
}

interface Room {
  code: string;
  host: WebSocket;
  guest: WebSocket | null;
  createdAt: number;
}

type JsonMessage = Record<string, unknown> & { t: string };

const send = (socket: WebSocket, message: Record<string, unknown>) => {
  if (socket.readyState === WebSocket.OPEN)
    socket.send(JSON.stringify(message));
};

const parseMessage = (data: RawData): JsonMessage | null => {
  try {
    const value: unknown = JSON.parse(data.toString());
    if (!value || typeof value !== 'object' || Array.isArray(value))
      return null;
    const message = value as Record<string, unknown>;
    return typeof message.t === 'string' ? (message as JsonMessage) : null;
  } catch {
    return null;
  }
};

const validGrid = (grid: unknown): boolean =>
  Array.isArray(grid) &&
  grid.length === GRID_SIZE &&
  grid.every(
    row =>
      Array.isArray(row) &&
      row.length === GRID_SIZE &&
      row.every(
        cell =>
          cell === null || (Number.isInteger(cell) && cell >= 0 && cell < 7),
      ),
  );

const newCode = () =>
  Array.from(
    { length: CODE_LENGTH },
    () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)],
  ).join('');

export class BattleHub {
  private readonly tickets = new Map<string, Ticket>();
  private readonly rooms = new Map<string, Room>();
  private readonly socketPlayers = new WeakMap<WebSocket, Player>();
  private readonly socketRooms = new WeakMap<WebSocket, Room>();

  issueTicket(id: string, name: string): string {
    const now = Date.now();
    for (const [token, ticket] of this.tickets) {
      if (ticket.expiresAt <= now) this.tickets.delete(token);
    }
    if (this.tickets.size >= 10_000)
      throw new Error('Servidor de partidas ocupado. Tente novamente.');

    const ticket = randomBytes(32).toString('hex');
    this.tickets.set(ticket, {
      id,
      name: cleanPlayerName(name),
      expiresAt: now + TICKET_TTL_MS,
    });
    return ticket;
  }

  attach(server: Server): void {
    const wss = new WebSocketServer({
      noServer: true,
      maxPayload: 16 * 1024,
      perMessageDeflate: false,
    });

    server.on('upgrade', (request, socket, head) => {
      const url = this.requestUrl(request);
      if (!url || url.pathname !== '/battle') {
        socket.destroy();
        return;
      }

      const ticket = url.searchParams.get('ticket');
      const claims = ticket ? this.tickets.get(ticket) : undefined;
      if (!ticket || !claims || claims.expiresAt <= Date.now()) {
        if (ticket) this.tickets.delete(ticket);
        socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
        socket.destroy();
        return;
      }
      this.tickets.delete(ticket);

      wss.handleUpgrade(request, socket, head, client => {
        this.socketPlayers.set(client, { id: claims.id, name: claims.name });
        this.handleClient(client);
        wss.emit('connection', client, request);
      });
    });

    const heartbeat = setInterval(() => {
      for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN) client.ping();
      }
    }, 25_000);
    wss.on('close', () => clearInterval(heartbeat));
    server.on('close', () => {
      clearInterval(heartbeat);
      for (const room of this.rooms.values()) {
        room.host.close(1012, 'Servidor reiniciando');
        room.guest?.close(1012, 'Servidor reiniciando');
      }
      this.rooms.clear();
      wss.close();
    });
  }

  private requestUrl(request: IncomingMessage): URL | null {
    try {
      return new URL(request.url ?? '/', 'http://localhost');
    } catch {
      return null;
    }
  }

  private handleClient(socket: WebSocket): void {
    socket.on('message', raw => {
      const message = parseMessage(raw);
      if (!message) {
        socket.close(1003, 'Mensagem inválida');
        return;
      }

      const room = this.socketRooms.get(socket);
      if (!room) {
        if (message.t === 'create') this.createRoom(socket);
        else if (message.t === 'join' && typeof message.code === 'string')
          this.joinRoom(socket, message.code);
        else this.fail(socket, 'A solicitação da sala é inválida.');
        return;
      }

      if (message.t === 'bye') {
        socket.close(1000, 'Jogador saiu');
      } else if (
        message.t === 'hello' &&
        typeof message.name === 'string' &&
        message.name.length <= 64
      ) {
        this.relay(room, socket, {
          t: 'hello',
          name: cleanPlayerName(message.name),
        });
      } else if (message.t === 'start' && socket === room.host) {
        this.relay(room, socket, { t: 'start' });
      } else if (
        message.t === 'state' &&
        Number.isInteger(message.score) &&
        (message.score as number) >= 0 &&
        (message.score as number) <= MAX_SCORE &&
        Number.isInteger(message.combo) &&
        (message.combo as number) >= 0 &&
        (message.combo as number) <= MAX_SCORE &&
        typeof message.over === 'boolean' &&
        validGrid(message.grid)
      ) {
        this.relay(room, socket, {
          t: 'state',
          score: message.score,
          combo: message.combo,
          over: message.over,
          grid: message.grid,
        });
      } else {
        socket.close(1008, 'Ação inválida');
      }
    });
    socket.on('close', () => this.detach(socket));
    socket.on('error', () => this.detach(socket));
  }

  private createRoom(socket: WebSocket): void {
    this.removeExpiredRooms();
    if (this.rooms.size >= MAX_ROOMS) {
      this.fail(socket, 'O servidor está cheio. Tente novamente mais tarde.');
      return;
    }

    let code = newCode();
    while (this.rooms.has(code)) code = newCode();

    const room: Room = {
      code,
      host: socket,
      guest: null,
      createdAt: Date.now(),
    };
    this.rooms.set(code, room);
    this.socketRooms.set(socket, room);
    send(socket, { t: 'room', code });
  }

  private joinRoom(socket: WebSocket, rawCode: string): void {
    const code = rawCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length !== CODE_LENGTH) {
      this.fail(socket, 'Digite o código de 5 caracteres da sala.');
      return;
    }

    this.removeExpiredRooms();
    const room = this.rooms.get(code);
    if (
      !room ||
      room.guest ||
      this.socketPlayers.get(room.host)?.id ===
        this.socketPlayers.get(socket)?.id
    ) {
      this.fail(
        socket,
        'Sala não encontrada, já está cheia ou é sua própria sala. Confira o código.',
      );
      return;
    }

    room.guest = socket;
    this.socketRooms.set(socket, room);
    send(socket, { t: 'joined', code });
    send(room.host, { t: 'peerJoined' });
  }

  private relay(
    room: Room,
    sender: WebSocket,
    message: Record<string, unknown>,
  ): void {
    const other = sender === room.host ? room.guest : room.host;
    if (other) send(other, message);
  }

  private detach(socket: WebSocket): void {
    const room = this.socketRooms.get(socket);
    if (!room) return;
    this.socketRooms.delete(socket);

    if (room.host === socket) {
      if (room.guest) {
        send(room.guest, { t: 'bye' });
        room.guest.close(1000, 'Anfitrião saiu');
        this.socketRooms.delete(room.guest);
      }
      this.rooms.delete(room.code);
      return;
    }

    if (room.guest === socket) {
      room.guest = null;
      send(room.host, { t: 'peerLeft' });
    }
  }

  private removeExpiredRooms(): void {
    const expiresBefore = Date.now() - ROOM_TTL_MS;
    for (const [code, room] of this.rooms) {
      if (room.createdAt > expiresBefore) continue;
      this.rooms.delete(code);
      send(room.host, {
        t: 'error',
        message: 'A sala expirou. Crie outra para jogar.',
      });
      room.host.close(1000, 'Sala expirada');
      if (room.guest) {
        send(room.guest, { t: 'bye' });
        room.guest.close(1000, 'Sala expirada');
      }
    }
  }

  private fail(socket: WebSocket, message: string): void {
    send(socket, { t: 'error', message });
    socket.close(1008, 'Solicitação recusada');
  }
}
