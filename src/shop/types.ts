/** Contratos compartilhados entre o app e a API (server/). */
export interface Profile {
  /** Código público do jogador (usado para adicionar amigos). */
  userId: string;
  name: string;
  coins: number;
  best: number;
  /** Quantidade de cada consumível. */
  inventory: Record<string, number>;
  /** Ids dos tabuleiros desbloqueados. */
  boards: string[];
  equipped: string;
}

export interface Friend {
  id: string;
  name: string;
  online: boolean;
  /** Pontuação da partida em andamento (0 se offline/parado). */
  score: number;
  best: number;
  /** Amigo simulado do modo demonstração (sem servidor). */
  simulated?: boolean;
}

export type ApiErrorCode =
  | 'network'
  | 'unauthorized'
  | 'not_found'
  | 'insufficient_funds'
  | 'already_owned'
  | 'not_owned'
  | 'invalid'
  | 'self'
  | 'forbidden';

export const USER_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const USER_CODE_LENGTH = 8;

export const normalizeUserCode = (raw: string): string =>
  raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, USER_CODE_LENGTH);

export const isUserCode = (s: string): boolean =>
  s.length === USER_CODE_LENGTH && [...s].every((ch) => USER_CODE_ALPHABET.includes(ch));

export const cleanPlayerName = (raw: unknown): string => {
  const s = typeof raw === 'string' ? raw.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16) : '';
  return s || 'Jogador';
};
