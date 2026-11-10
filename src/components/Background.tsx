import React, { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

const TOP: [number, number, number] = [38, 18, 84];
const MID: [number, number, number] = [18, 38, 110];
const BOTTOM: [number, number, number] = [6, 78, 110];
const BANDS = 28;

const mix = (a: number[], b: number[], t: number) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

const bandColor = (t: number) => {
  const c = t < 0.55 ? mix(TOP, MID, t / 0.55) : mix(MID, BOTTOM, (t - 0.55) / 0.45);
  return `rgb(${c[0]},${c[1]},${c[2]})`;
};

// Deterministic pseudo-random so stars don't move between renders.
const rand = (seed: number) => {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
};

const STAR_COLORS = ['#ffffff', '#fde68a', '#bae6fd', '#fbcfe8'];

function BackgroundImpl() {
  const stars = useMemo(
    () =>
      Array.from({ length: 46 }, (_, i) => {
        const size = 1 + Math.floor(rand(i + 1) * 3);
        return {
          key: i,
          left: `${rand(i + 100) * 100}%`,
          top: `${rand(i + 200) * 92}%`,
          size,
          opacity: 0.25 + rand(i + 300) * 0.65,
          color: STAR_COLORS[Math.floor(rand(i + 400) * STAR_COLORS.length)],
        };
      }),
    [],
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: BANDS }, (_, i) => (
        <View key={i} style={{ flex: 1, backgroundColor: bandColor(i / (BANDS - 1)) }} />
      ))}
      <View style={styles.moonGlow} />
      <View style={styles.moon} />
      {stars.map((s) => (
        <View
          key={s.key}
          style={{
            position: 'absolute',
            left: s.left as `${number}%`,
            top: s.top as `${number}%`,
            width: s.size,
            height: s.size,
            borderRadius: s.size,
            backgroundColor: s.color,
            opacity: s.opacity,
          }}
        />
      ))}
      <View style={styles.horizonGlow} />
      <View style={styles.horizonLine} />
    </View>
  );
}

export const Background = memo(BackgroundImpl);

const styles = StyleSheet.create({
  moonGlow: {
    position: 'absolute',
    top: 110,
    right: -10,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(253,230,138,0.10)',
  },
  moon: {
    position: 'absolute',
    top: 140,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(254,243,199,0.22)',
  },
  horizonGlow: {
    position: 'absolute',
    left: -40,
    right: -40,
    bottom: -90,
    height: 200,
    borderRadius: 200,
    backgroundColor: 'rgba(34,211,238,0.16)',
  },
  horizonLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: 'rgba(103,232,249,0.35)',
  },
});
