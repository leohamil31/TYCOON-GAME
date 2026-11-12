/**
 * Catálogo da loja. Arquivo puro (sem React) — o servidor Node importa este mesmo arquivo,
 * então preços e regras têm uma única fonte da verdade.
 */
/** board = tema do tabuleiro; skin = visual das peças; fx = efeito de limpeza; bundle = pacote de itens. */
export type ItemKind = 'board' | 'skin' | 'fx' | 'consumable' | 'bundle';

/** Itens que, uma vez comprados, ficam para sempre e são "equipados". */
export const COSMETIC_KINDS: readonly ItemKind[] = ['board', 'skin', 'fx'];
export const isCosmetic = (kind: ItemKind) => COSMETIC_KINDS.includes(kind);

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
  /** Pacotes: o que o jogador recebe (id do consumível -> quantidade). */
  grants?: Record<string, number>;
  /** Ataques: só podem ser usados na batalha online. */
  battle?: boolean;
}

export interface CoinPack {
  id: string;
  coins: number;
  realCents: number;
  icon: string;
}

export const DEFAULT_BOARD = 'classic';
export const DEFAULT_SKIN = 'skin_classic';
export const DEFAULT_FX = 'fx_classic';

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
    id: 'aurora',
    kind: 'board',
    name: 'Aurora Boreal',
    desc: 'Cortinas de luz verde e violeta ondulando no céu.',
    icon: '🌌',
    price: 1500,
    realCents: 790,
  },
  {
    id: 'abyss',
    kind: 'board',
    name: 'Abismo',
    desc: 'Fundo do mar com bolhas e águas-vivas brilhantes.',
    icon: '🪼',
    price: 1800,
    realCents: 890,
  },
  {
    id: 'ember',
    kind: 'board',
    name: 'Forja',
    desc: 'Brasas subindo da serralheria incandescente.',
    icon: '🔥',
    price: 2200,
    realCents: 990,
  },

  // ---------------------------------------------------------------- skins das peças
  { id: 'skin_classic', kind: 'skin', name: 'Cubos 3D', desc: 'As peças clássicas com volume.', icon: '🧊', price: 0 },
  { id: 'skin_neon', kind: 'skin', name: 'Neon', desc: 'Contornos luminosos sobre fundo escuro.', icon: '💡', price: 800 },
  { id: 'skin_glass', kind: 'skin', name: 'Cristal', desc: 'Vidro colorido translúcido com reflexo.', icon: '💎', price: 900 },
  { id: 'skin_pixel', kind: 'skin', name: 'Pixel 8-bit', desc: 'Visual retrô de fliperama.', icon: '👾', price: 700 },

  // ---------------------------------------------------------------- efeitos de limpeza
  { id: 'fx_classic', kind: 'fx', name: 'Estilhaços', desc: 'Os blocos voam girando.', icon: '💥', price: 0 },
  { id: 'fx_stars', kind: 'fx', name: 'Chuva de Estrelas', desc: 'Cada bloco vira uma estrela dourada.', icon: '✨', price: 700 },
  { id: 'fx_pixel', kind: 'fx', name: 'Desintegrar', desc: 'Os blocos se desfazem em pixels.', icon: '🟪', price: 600 },
  { id: 'fx_bubbles', kind: 'fx', name: 'Bolhas', desc: 'Bolhas que sobem e estouram.', icon: '🫧', price: 800 },

  // ---------------------------------------------------------------- power-ups
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
    desc: 'Você escolhe onde: explode uma área 3x3 do seu tabuleiro.',
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

  // ---------------------------------------------------------------- ataques (só na batalha)
  {
    id: 'garbage',
    kind: 'consumable',
    name: 'Blocos de Lixo',
    desc: 'Joga 4 blocos de entulho no tabuleiro do rival.',
    icon: '🧱',
    price: 180,
    battle: true,
  },
  {
    id: 'freeze',
    kind: 'consumable',
    name: 'Congelar',
    desc: 'Congela a bandeja do rival por 4 segundos.',
    icon: '❄️',
    price: 250,
    battle: true,
  },
  {
    id: 'rubble',
    kind: 'consumable',
    name: 'Bomba de Entulho',
    desc: 'Mire no tabuleiro do rival e encha uma área 3x3 de entulho.',
    icon: '☄️',
    price: 300,
    battle: true,
  },

  // ---------------------------------------------------------------- pacotes
  {
    id: 'pack_bombs',
    kind: 'bundle',
    name: 'Caixa de Bombas',
    desc: '5 bombas com desconto (economize 200).',
    icon: '📦',
    price: 800,
    grants: { bomb: 5 },
  },
  {
    id: 'pack_war',
    kind: 'bundle',
    name: 'Arsenal de Batalha',
    desc: '3 lixo + 2 congelar + 2 entulho (economize 340).',
    icon: '⚔️',
    price: 1300,
    grants: { garbage: 3, freeze: 2, rubble: 2 },
  },
];

/** Ataques da batalha, na ordem da barra. */
export const ATTACK_IDS = ['garbage', 'freeze', 'rubble'] as const;
export type AttackId = (typeof ATTACK_IDS)[number];

/** Ordem dos power-ups na barra da partida. */
export const POWERUP_IDS = ['boost_x2', 'bomb', 'reroll', 'undo', 'shield'] as const;
export type PowerupId = (typeof POWERUP_IDS)[number];

/** Kit inicial de perfis novos (modo demonstração), para o jogador experimentar cada item. */
export const STARTER_KIT: Record<string, number> = { boost_x2: 1, bomb: 1, reroll: 1, undo: 1, shield: 1, garbage: 2, freeze: 1, rubble: 1 };

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
