/**
 * Catálogo da loja. Arquivo puro (sem React) — o servidor Node importa este mesmo arquivo,
 * então preços e regras têm uma única fonte da verdade.
 */
export type ItemKind = 'board' | 'consumable';

export interface ShopItem {
  id: string;
  kind: ItemKind;
  name: string;
  desc: string;
  icon: string;
  /** Preço em moedas do jogo. 0 = já vem desbloqueado. */
  price: number;
  /** Preço em centavos de R$ para a compra (simulada) com dinheiro real. Só tabuleiros premium. */
  realCents?: number;
}

export interface CoinPack {
  id: string;
  coins: number;
  realCents: number;
  icon: string;
}

export const DEFAULT_BOARD = 'classic';

export const ITEMS: readonly ShopItem[] = [
  { id: 'classic', kind: 'board', name: 'Noturno', desc: 'O céu estrelado clássico.', icon: '🌙', price: 0 },
  {
    id: 'neon',
    kind: 'board',
    name: 'Neon Futurista',
    desc: 'Grade synthwave em movimento e sol neon.',
    icon: '🌆',
    price: 600,
    realCents: 490,
  },
  {
    id: 'space',
    kind: 'board',
    name: 'Espaço Profundo',
    desc: 'Estrelas e partículas cruzando a galáxia.',
    icon: '🪐',
    price: 1200,
    realCents: 790,
  },
  {
    id: 'cyber',
    kind: 'board',
    name: 'Cyberpunk',
    desc: 'Chuva ácida, skyline e letreiros pulsando.',
    icon: '🌃',
    price: 2000,
    realCents: 990,
  },
  {
    id: 'boost_x2',
    kind: 'consumable',
    name: 'Multiplicador x2',
    desc: 'Dobra os pontos das próximas 5 jogadas.',
    icon: '⚡',
    price: 150,
  },
  {
    id: 'shield',
    kind: 'consumable',
    name: 'Escudo',
    desc: 'Salva você do fim de jogo e abre espaço no tabuleiro.',
    icon: '🛡️',
    price: 300,
  },
  {
    id: 'bomb',
    kind: 'consumable',
    name: 'Bomba',
    desc: 'Explode a área central do tabuleiro.',
    icon: '💣',
    price: 200,
  },
  {
    id: 'reroll',
    kind: 'consumable',
    name: 'Nova Mão',
    desc: 'Troca as 3 peças da bandeja por peças novas.',
    icon: '🔄',
    price: 120,
  },
  {
    id: 'undo',
    kind: 'consumable',
    name: 'Desfazer',
    desc: 'Volta a última jogada (inclusive depois de ficar sem jogadas).',
    icon: '↩️',
    price: 100,
  },
];

/** Ordem dos power-ups na barra da partida. */
export const POWERUP_IDS = ['boost_x2', 'bomb', 'reroll', 'undo', 'shield'] as const;
export type PowerupId = (typeof POWERUP_IDS)[number];

/** Kit inicial de perfis novos (modo demonstração), para o jogador experimentar cada item. */
export const STARTER_KIT: Record<string, number> = { boost_x2: 1, bomb: 1, reroll: 1, undo: 1, shield: 1 };

export const COIN_PACKS: readonly CoinPack[] = [
  { id: 'coins_500', coins: 500, realCents: 490, icon: '🪙' },
  { id: 'coins_1500', coins: 1500, realCents: 1290, icon: '💰' },
  { id: 'coins_4000', coins: 4000, realCents: 2990, icon: '💎' },
];

export const BOOST_MOVES = 5;

export const itemById = (id: string): ShopItem | undefined => ITEMS.find((i) => i.id === id);
export const packById = (id: string): CoinPack | undefined => COIN_PACKS.find((p) => p.id === id);

/** Moedas ganhas ao fim de uma partida. */
export const coinsForScore = (score: number): number => Math.floor(Math.max(0, score) / 20);

/** Teto de pontos aceito por partida (anti-cheat básico do servidor). */
export const MAX_RUN_SCORE = 200000;

export const formatBRL = (cents: number): string => `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;
