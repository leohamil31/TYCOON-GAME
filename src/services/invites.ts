import { cleanName } from '../storage';
import { normalizeUserCode, isUserCode } from '../shop/types';
import { supabase } from './supabase';

/** Desafio enviado de um amigo para outro: "entre na minha sala". */
export interface Invite {
  /** Código de amigo de quem convidou. */
  from: string;
  name: string;
  /** Código da sala de batalha (5 caracteres). */
  room: string;
  at: number;
}

const inbox = (code: string) => `tycoon-inbox-${code}`;
const INVITE_TTL_MS = 60_000;

const parseInvite = (raw: unknown): Invite | null => {
  const m = raw as Partial<Invite> | null;
  if (!m || typeof m.room !== 'string' || typeof m.from !== 'string') return null;
  const room = m.room.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
  const from = normalizeUserCode(m.from);
  const at = typeof m.at === 'number' ? m.at : 0;
  if (room.length !== 5 || !isUserCode(from) || Date.now() - at > INVITE_TTL_MS) return null;
  return { from, room, at, name: cleanName(m.name) || 'Amigo' };
};

/** Escuta convites endereçados ao meu código. Retorna a função para parar de escutar. */
export function listenInvites(myCode: string, onInvite: (inv: Invite) => void): () => void {
  const sb = supabase;
  if (!sb) return () => {};
  const ch = sb.channel(inbox(myCode), { config: { broadcast: { self: false } } });
  ch.on('broadcast', { event: 'invite' }, ({ payload }: { payload: unknown }) => {
    const inv = parseInvite(payload);
    if (inv) onInvite(inv);
  });
  ch.subscribe();
  return () => void sb.removeChannel(ch);
}

/** Envia um desafio para o amigo (ele precisa estar com o jogo aberto). */
export function sendInvite(friendCode: string, invite: Omit<Invite, 'at'>): Promise<void> {
  const sb = supabase;
  if (!sb) return Promise.reject(new Error('Servidor não configurado.'));
  return new Promise((resolve, reject) => {
    const ch = sb.channel(inbox(friendCode), { config: { broadcast: { self: false, ack: true } } });
    const timer = setTimeout(() => {
      void sb.removeChannel(ch);
      reject(new Error('Não foi possível enviar o convite.'));
    }, 8000);
    ch.subscribe(async (status: string) => {
      if (status !== 'SUBSCRIBED') return;
      await ch.send({ type: 'broadcast', event: 'invite', payload: { ...invite, at: Date.now() } });
      clearTimeout(timer);
      setTimeout(() => void sb.removeChannel(ch), 300);
      resolve();
    });
  });
}
