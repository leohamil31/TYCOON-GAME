/** Contratos compartilhados entre o app e a API (server/). */
export interface Profile {
  /** Código público do jogador (usado para adicionar amigos). */
  userId: string;
  name: string;
  coins: number;
  best: number;
  /** Quantidade de cada consumível. */
  inventory: Record<string, number>;
  /** Ids dos cosméticos desbloqueados (tabuleiros, skins e efeitos; os grátis não precisam estar aqui). */
  boards: string[];
  /** Tabuleiro equipado. */
  equipped: string;
  /** Skin das peças equipada. */
  skin?: string;
  /** Efeito de limpeza equipado. */
  effect?: string;
  /** Batalhas vencidas / jogadas. */
  wins?: number;
  battles?: number;
  /** Progressão (servidor): XP total, nível, XP dentro do nível e necessário para o próximo. */
  xp?: number;
  level?: number;
  xpInto?: number;
  xpNeed?: number;
  /** Baús ainda não abertos (1 por nível). */
  chests?: number;
  /** Dias seguidos pegando a recompensa diária. */
  streak?: number;
}

export interface Mission {
  id: string;
  title: string;
  icon: string;
  target: number;
  progress: number;
  reward: number;
  xp: number;
  claimed: boolean;
  battle: boolean;
}

export interface DailyState {
  day: string;
  streak: number;
  canClaimDaily: boolean;
  dailyCoins: number;
  dailyChest: boolean;
  nextStreak: number;
  missions: Mission[];
  profile: Profile;
}

export type ChestReward =
  | { kind: 'coins'; amount: number }
  | { kind: 'items'; items: Record<string, number> }
  | { kind: 'cosmetic'; id: string };

/** Eventos de partida que contam para as missões. */
export type MissionEvents = Partial<Record<'lines' | 'combos' | 'bombs' | 'attacks', number>>;

/** Linha do ranking (global ou de amigos). */
export interface RankEntry {
  rank: number;
  name: string;
  best: number;
  wins: number;
  /** Código de amigo (só para amigos/você). */
  code?: string;
  me?: boolean;
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
