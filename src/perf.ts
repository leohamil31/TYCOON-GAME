import { Platform } from 'react-native';

/**
 * Modo leve: desliga o que mais pesa na placa de vídeo de celulares (principalmente Android):
 * desfoque de vidro (backdrop-filter), animações contínuas do fundo e ícones, sombras grandes por bloco
 * e partículas extras. O jogo continua com todos os efeitos de jogada (explosões, combos, pontos).
 *
 * Liga sozinho no app Android e, na web, em Android ou aparelhos com até 4 núcleos / 4 GB.
 * O jogador pode ligar/desligar em Ajustes (salvo neste aparelho; na web vale ao recarregar).
 */
const KEY = 'tycoon_lite_v1';

type Nav = { userAgent?: string; hardwareConcurrency?: number; deviceMemory?: number };
type Store = { getItem(k: string): string | null; setItem(k: string, v: string): void };

const store = (): Store | null => {
  try {
    return (globalThis as { localStorage?: Store }).localStorage ?? null;
  } catch {
    return null;
  }
};

function autoLite(): boolean {
  if (Platform.OS === 'android') return true;
  if (Platform.OS !== 'web') return false;
  const nav = (globalThis as { navigator?: Nav }).navigator ?? {};
  const android = /Android/i.test(nav.userAgent ?? '');
  const weakCpu = (nav.hardwareConcurrency ?? 8) <= 4;
  const lowMem = (nav.deviceMemory ?? 8) <= 4;
  return android || weakCpu || lowMem;
}

function readChoice(): boolean | null {
  const v = store()?.getItem(KEY);
  return v === '1' ? true : v === '0' ? false : null;
}

/** true = modo leve ativo nesta sessão. */
export const LITE: boolean = readChoice() ?? autoLite();
/** Se o modo leve foi ligado automaticamente (sem escolha do jogador). */
export const LITE_AUTO = readChoice() === null;

/** Salva a escolha. Na web recarrega a página para aplicar (os estilos são montados na abertura). */
export function setLite(on: boolean) {
  store()?.setItem(KEY, on ? '1' : '0');
  if (Platform.OS === 'web') (globalThis as { location?: { reload(): void } }).location?.reload();
}
