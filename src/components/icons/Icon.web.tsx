import React from 'react';
import { ICONS, type IconName } from './data';

interface Props {
  name: IconName;
  size?: number;
  color?: string;
  /** Espessura do traço (24 = tamanho base). */
  stroke?: number;
  /** Brilho neon em volta do traço (só na web). */
  glow?: boolean;
  fill?: string;
}

/** Ícone vetorial (web): <svg> nativo do navegador, sem dependências. */
export function Icon({ name, size = 24, color = '#fff', stroke = 2.2, glow, fill = 'none' }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke={color}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'block', overflow: 'visible', filter: glow ? `drop-shadow(0 0 ${size * 0.18}px ${color})` : undefined, pointerEvents: 'none' }}
    >
      {ICONS[name].map(([tag, attrs], i) => React.createElement(tag, { key: i, ...attrs }))}
    </svg>
  );
}
