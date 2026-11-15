import React from 'react';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { ICONS, type IconName } from './data';

interface Props {
  name: IconName;
  size?: number;
  color?: string;
  stroke?: number;
  glow?: boolean;
  fill?: string;
}

const TAGS = { path: Path, circle: Circle, rect: Rect, line: Line } as const;

/** Ícone vetorial (Android/iOS) com react-native-svg. */
export function Icon({ name, size = 24, color = '#fff', stroke = 2.2, fill = 'none' }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      {ICONS[name].map(([tag, attrs], i) => {
        const C = TAGS[tag] as React.ComponentType<Record<string, unknown>>;
        return <C key={i} {...attrs} />;
      })}
    </Svg>
  );
}
