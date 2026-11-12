import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';
import { USE_NATIVE_DRIVER } from '../theme';
import { Background } from './Background';

const rand = (seed: number) => {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
};
const mix = (a: number[], b: number[], t: number) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

/** Valor 0→1 em loop linear (translações) ou ida-e-volta (pulsos). */
function useLoop(duration: number, pingPong = false): Animated.Value {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const up = Animated.timing(v, {
      toValue: 1,
      duration,
      easing: pingPong ? Easing.inOut(Easing.sin) : Easing.linear,
      useNativeDriver: USE_NATIVE_DRIVER,
    });
    const anim = Animated.loop(
      pingPong
        ? Animated.sequence([
            up,
            Animated.timing(v, {
              toValue: 0,
              duration,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
          ])
        : up,
    );
    anim.start();
    return () => anim.stop();
  }, [v, duration, pingPong]);
  return v;
}

interface Size {
  w: number;
  h: number;
}

function Bands({ top, mid, bottom, count = 18 }: { top: number[]; mid: number[]; bottom: number[]; count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const t = i / (count - 1);
        const c = t < 0.6 ? mix(top, mid, t / 0.6) : mix(mid, bottom, (t - 0.6) / 0.4);
        return <View key={i} style={{ flex: 1, backgroundColor: `rgb(${c[0]},${c[1]},${c[2]})` }} />;
      })}
    </>
  );
}

function Pulse({ duration, style, from = 0.4, to = 1 }: { duration: number; style: object; from?: number; to?: number }) {
  const v = useLoop(duration, true);
  return <Animated.View style={[style, { opacity: v.interpolate({ inputRange: [0, 1], outputRange: [from, to] }) }]} />;
}

// ------------------------------------------------------------------ NEON FUTURISTA
const NEON_STEP = 30;

function NeonScene({ w, h }: Size) {
  const scroll = useLoop(1800);
  const floorH = Math.round(h * 0.34);
  const rows = Math.ceil(floorH / NEON_STEP) + 1;
  const cols = Math.ceil(w / 44) + 1;
  const sunSize = Math.min(w * 0.62, 240);
  return (
    <>
      <Bands top={[20, 0, 52]} mid={[58, 8, 88]} bottom={[120, 18, 110]} />
      <Pulse
        duration={2600}
        from={0.35}
        to={0.7}
        style={{
          position: 'absolute',
          left: (w - sunSize * 1.5) / 2,
          bottom: floorH - sunSize * 0.35,
          width: sunSize * 1.5,
          height: sunSize * 1.5,
          borderRadius: sunSize,
          backgroundColor: 'rgba(244,114,182,0.28)',
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: (w - sunSize) / 2,
          bottom: floorH - sunSize * 0.1,
          width: sunSize,
          height: sunSize,
          borderRadius: sunSize / 2,
          backgroundColor: '#fb7185',
          overflow: 'hidden',
        }}
      >
        {[0.5, 0.62, 0.72, 0.8, 0.87, 0.93].map((p, i) => (
          <View
            key={i}
            style={{ position: 'absolute', left: 0, right: 0, top: sunSize * p, height: 2 + i * 1.5, backgroundColor: '#3b0764' }}
          />
        ))}
      </View>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: floorH, backgroundColor: '#12002b', overflow: 'hidden' }}>
        {Array.from({ length: cols }, (_, i) => (
          <View
            key={i}
            style={{ position: 'absolute', top: 0, bottom: 0, left: i * 44, width: 1, backgroundColor: 'rgba(34,211,238,0.32)' }}
          />
        ))}
        <Animated.View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: -NEON_STEP,
            transform: [{ translateY: scroll.interpolate({ inputRange: [0, 1], outputRange: [0, NEON_STEP] }) }],
          }}
        >
          {Array.from({ length: rows + 1 }, (_, i) => (
            <View key={i} style={{ height: NEON_STEP }}>
              <View style={{ height: 1.5, backgroundColor: 'rgba(244,114,182,0.5)' }} />
            </View>
          ))}
        </Animated.View>
      </View>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: floorH - 1, height: 2, backgroundColor: '#22d3ee' }} />
    </>
  );
}

// ------------------------------------------------------------------ ESPAÇO
function Star({ i, w, h }: { i: number } & Size) {
  const size = 1 + Math.floor(rand(i + 5) * 3);
  const dur = 5000 + rand(i + 9) * 9000;
  const v = useLoop(dur);
  const startY = rand(i + 3) * h;
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: rand(i + 1) * w,
        top: -10,
        width: size,
        height: size * (size > 2 ? 3 : 2),
        borderRadius: size,
        backgroundColor: i % 5 === 0 ? '#fde68a' : i % 4 === 0 ? '#a5f3fc' : '#fff',
        opacity: 0.35 + rand(i + 7) * 0.65,
        transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [startY - h * 0.3, startY + h * 1.1] }) }],
      }}
    />
  );
}

function SpaceScene({ w, h }: Size) {
  const spin = useLoop(60000);
  const shoot = useLoop(7000);
  return (
    <>
      <Bands top={[4, 6, 22]} mid={[10, 14, 46]} bottom={[22, 10, 58]} />
      <Pulse
        duration={5000}
        from={0.25}
        to={0.6}
        style={{ position: 'absolute', left: -w * 0.2, top: h * 0.08, width: w * 0.9, height: w * 0.9, borderRadius: w, backgroundColor: 'rgba(124,58,237,0.22)' }}
      />
      <Pulse
        duration={6500}
        from={0.2}
        to={0.5}
        style={{ position: 'absolute', right: -w * 0.25, top: h * 0.45, width: w * 0.85, height: w * 0.85, borderRadius: w, backgroundColor: 'rgba(14,165,233,0.2)' }}
      />
      {Array.from({ length: 40 }, (_, i) => (
        <Star key={i} i={i} w={w} h={h} />
      ))}
      <Animated.View
        style={{
          position: 'absolute',
          left: w * 0.62,
          bottom: h * 0.08,
          width: w * 0.34,
          height: w * 0.34,
          borderRadius: w,
          backgroundColor: '#7c3aed',
          borderBottomColor: '#312e81',
          borderBottomWidth: w * 0.05,
          transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
          opacity: 0.85,
        }}
      />
      <Animated.View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: 90,
          height: 2,
          backgroundColor: '#e0f2fe',
          opacity: shoot.interpolate({ inputRange: [0, 0.05, 0.18, 0.2, 1], outputRange: [0, 1, 0.8, 0, 0] }),
          transform: [
            { translateX: shoot.interpolate({ inputRange: [0, 0.2, 1], outputRange: [w * 0.9, w * 0.1, w * 0.1] }) },
            { translateY: shoot.interpolate({ inputRange: [0, 0.2, 1], outputRange: [h * 0.1, h * 0.35, h * 0.35] }) },
            { rotate: '-35deg' },
          ],
        }}
      />
    </>
  );
}

// ------------------------------------------------------------------ CYBERPUNK
function Rain({ i, w, h }: { i: number } & Size) {
  const v = useLoop(900 + rand(i + 2) * 900);
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: rand(i + 11) * (w + 80) - 40,
        top: -40,
        width: 1.5,
        height: 18 + rand(i + 4) * 20,
        backgroundColor: i % 3 === 0 ? 'rgba(232,121,249,0.55)' : 'rgba(103,232,249,0.5)',
        transform: [
          { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, h + 80] }) },
          { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, -60] }) },
          { rotate: '20deg' },
        ],
      }}
    />
  );
}

function CyberScene({ w, h }: Size) {
  const scan = useLoop(4200);
  const buildings = useMemo(() => {
    const out: { x: number; bw: number; bh: number; tone: string }[] = [];
    let x = -10;
    let i = 0;
    while (x < w) {
      const bw = 34 + rand(i + 20) * 46;
      out.push({ x, bw, bh: h * (0.14 + rand(i + 30) * 0.3), tone: rand(i + 40) > 0.5 ? '#0f0820' : '#1a0b33' });
      x += bw + 2;
      i++;
    }
    return out;
  }, [w, h]);
  return (
    <>
      <Bands top={[8, 4, 20]} mid={[30, 8, 56]} bottom={[70, 10, 80]} />
      <Pulse
        duration={3000}
        from={0.25}
        to={0.6}
        style={{ position: 'absolute', left: -20, right: -20, bottom: h * 0.12, height: h * 0.25, borderRadius: 200, backgroundColor: 'rgba(232,121,249,0.25)' }}
      />
      {buildings.map((b, i) => (
        <View key={i} style={{ position: 'absolute', left: b.x, bottom: 0, width: b.bw, height: b.bh, backgroundColor: b.tone, borderTopWidth: 1, borderTopColor: 'rgba(34,211,238,0.35)' }}>
          {Array.from({ length: 6 }, (_, k) => (
            <View
              key={k}
              style={{
                position: 'absolute',
                left: 5 + rand(i * 7 + k) * (b.bw - 12),
                top: 8 + rand(i * 13 + k) * Math.max(10, b.bh - 20),
                width: 3,
                height: 3,
                backgroundColor: rand(i + k) > 0.5 ? '#fde047' : '#22d3ee',
                opacity: 0.8,
              }}
            />
          ))}
        </View>
      ))}
      <Pulse
        duration={900}
        from={0.45}
        to={1}
        style={{ position: 'absolute', left: w * 0.08, top: h * 0.2, width: 78, height: 26, borderRadius: 6, borderWidth: 2, borderColor: '#f0abfc', backgroundColor: 'rgba(192,38,211,0.25)' }}
      />
      <Pulse
        duration={1400}
        from={0.35}
        to={1}
        style={{ position: 'absolute', right: w * 0.1, top: h * 0.3, width: 26, height: 70, borderRadius: 6, borderWidth: 2, borderColor: '#67e8f9', backgroundColor: 'rgba(8,145,178,0.25)' }}
      />
      {Array.from({ length: 22 }, (_, i) => (
        <Rain key={i} i={i} w={w} h={h} />
      ))}
      <Animated.View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: 60,
          backgroundColor: 'rgba(103,232,249,0.06)',
          transform: [{ translateY: scan.interpolate({ inputRange: [0, 1], outputRange: [-60, h] }) }],
        }}
      />
    </>
  );
}


// ------------------------------------------------------------------ AURORA BOREAL
function AuroraBand({ i, w, h }: { i: number } & Size) {
  const v = useLoop(7000 + i * 1800, true);
  const colors = ['rgba(52,211,153,0.30)', 'rgba(167,139,250,0.26)', 'rgba(45,212,191,0.24)', 'rgba(244,114,182,0.18)'];
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: -w * 0.3,
        width: w * 1.6,
        top: h * (0.08 + i * 0.09),
        height: h * 0.16,
        borderRadius: h,
        backgroundColor: colors[i % colors.length],
        opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.95] }),
        transform: [
          { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [-w * 0.12, w * 0.12] }) },
          { rotate: `${-8 + i * 5}deg` },
          { scaleY: v.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.25] }) },
        ],
      }}
    />
  );
}

function AuroraScene({ w, h }: Size) {
  return (
    <>
      <Bands top={[2, 8, 20]} mid={[6, 22, 40]} bottom={[8, 30, 44]} />
      {Array.from({ length: 30 }, (_, i) => (
        <View
          key={`s${i}`}
          style={{ position: 'absolute', left: rand(i + 3) * w, top: rand(i + 7) * h * 0.7, width: 2, height: 2, borderRadius: 1, backgroundColor: '#fff', opacity: 0.3 + rand(i) * 0.6 }}
        />
      ))}
      {[0, 1, 2, 3].map((i) => (
        <AuroraBand key={i} i={i} w={w} h={h} />
      ))}
      {/* Montanhas */}
      {[0, 1, 2, 3, 4].map((i) => (
        <View
          key={`m${i}`}
          style={{
            position: 'absolute',
            bottom: -h * 0.12,
            left: w * (i * 0.25 - 0.2),
            width: w * 0.55,
            height: w * 0.55,
            backgroundColor: i % 2 ? '#04131a' : '#062029',
            transform: [{ rotate: '45deg' }],
          }}
        />
      ))}
    </>
  );
}

// ------------------------------------------------------------------ ABISMO
function Bubble({ i, w, h }: { i: number } & Size) {
  const v = useLoop(6000 + rand(i + 2) * 7000);
  const s = 4 + rand(i + 5) * 12;
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: rand(i + 11) * w,
        top: h,
        width: s,
        height: s,
        borderRadius: s,
        borderWidth: 1.2,
        borderColor: 'rgba(165,243,252,0.7)',
        backgroundColor: 'rgba(165,243,252,0.08)',
        transform: [
          { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -h - 30] }) },
          { translateX: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 14, -6] }) },
        ],
      }}
    />
  );
}

function Jelly({ x, y, size, tone, dur }: { x: number; y: number; size: number; tone: string; dur: number }) {
  const v = useLoop(dur, true);
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: x,
        top: y,
        alignItems: 'center',
        transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [12, -18] }) }],
      }}
    >
      <Animated.View
        style={{
          width: size,
          height: size * 0.6,
          borderTopLeftRadius: size,
          borderTopRightRadius: size,
          backgroundColor: tone,
          opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.85] }),
          transform: [{ scaleX: v.interpolate({ inputRange: [0, 1], outputRange: [1.08, 0.92] }) }],
        }}
      />
      <View style={{ flexDirection: 'row', gap: size * 0.12 }}>
        {[0, 1, 2, 3].map((k) => (
          <View key={k} style={{ width: 2, height: size * (0.5 + (k % 2) * 0.25), backgroundColor: tone, opacity: 0.45 }} />
        ))}
      </View>
    </Animated.View>
  );
}

function AbyssScene({ w, h }: Size) {
  const ray = useLoop(5000, true);
  return (
    <>
      <Bands top={[6, 40, 70]} mid={[4, 22, 48]} bottom={[2, 8, 22]} />
      {[0.15, 0.45, 0.72].map((x, i) => (
        <Animated.View
          key={`r${i}`}
          style={{
            position: 'absolute',
            left: w * x,
            top: -h * 0.1,
            width: w * 0.12,
            height: h * 0.8,
            backgroundColor: 'rgba(186,230,253,0.07)',
            transform: [{ rotate: `${12 - i * 6}deg` }],
            opacity: ray.interpolate({ inputRange: [0, 1], outputRange: i % 2 ? [0.4, 1] : [1, 0.4] }),
          }}
        />
      ))}
      <Jelly x={w * 0.12} y={h * 0.3} size={Math.min(70, w * 0.16)} tone="#f0abfc" dur={4200} />
      <Jelly x={w * 0.72} y={h * 0.5} size={Math.min(54, w * 0.13)} tone="#67e8f9" dur={5200} />
      {Array.from({ length: 22 }, (_, i) => (
        <Bubble key={i} i={i} w={w} h={h} />
      ))}
    </>
  );
}

// ------------------------------------------------------------------ FORJA
function Ember({ i, w, h }: { i: number } & Size) {
  const v = useLoop(2600 + rand(i + 4) * 3200);
  const s = 2 + rand(i + 8) * 4;
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: rand(i + 13) * w,
        top: h * 0.95,
        width: s,
        height: s,
        borderRadius: s,
        backgroundColor: i % 3 === 0 ? '#fde68a' : '#fb923c',
        opacity: v.interpolate({ inputRange: [0, 0.1, 0.8, 1], outputRange: [0, 1, 0.7, 0] }),
        transform: [
          { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -h * (0.5 + rand(i) * 0.5)] }) },
          { translateX: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, (rand(i + 1) - 0.5) * 60, (rand(i + 2) - 0.5) * 30] }) },
        ],
      }}
    />
  );
}

function EmberScene({ w, h }: Size) {
  return (
    <>
      <Bands top={[10, 4, 6]} mid={[38, 10, 8]} bottom={[110, 30, 10]} />
      <Pulse
        duration={1800}
        from={0.35}
        to={0.75}
        style={{ position: 'absolute', left: -w * 0.2, right: -w * 0.2, bottom: -h * 0.12, height: h * 0.35, borderRadius: w, backgroundColor: 'rgba(249,115,22,0.35)' }}
      />
      {/* Bigorna e vigas da serralheria em silhueta */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: h * 0.07, backgroundColor: '#0d0503' }} />
      <View style={{ position: 'absolute', left: w * 0.08, bottom: h * 0.07, width: w * 0.22, height: h * 0.05, backgroundColor: '#0d0503', borderTopLeftRadius: 30 }} />
      <View style={{ position: 'absolute', left: w * 0.15, bottom: h * 0.035, width: w * 0.08, height: h * 0.05, backgroundColor: '#0d0503' }} />
      {[0.62, 0.8].map((x, i) => (
        <View key={i} style={{ position: 'absolute', left: w * x, bottom: h * 0.07, width: 10, height: h * 0.3, backgroundColor: '#140805' }} />
      ))}
      <View style={{ position: 'absolute', left: w * 0.58, bottom: h * 0.36, width: w * 0.34, height: 10, backgroundColor: '#140805' }} />
      {Array.from({ length: 28 }, (_, i) => (
        <Ember key={i} i={i} w={w} h={h} />
      ))}
    </>
  );
}

// ------------------------------------------------------------------ fachada
interface Props {
  themeId: string;
  /** Pausa/baixa custo em miniaturas: renderiza o mesmo cenário, apenas menor. */
  preview?: boolean;
}

const SCENES = ['neon', 'space', 'cyber', 'aurora', 'abyss', 'ember'];

function ThemedBackdropImpl({ themeId, preview }: Props) {
  const win = useWindowDimensions();
  const [size, setSize] = useState<Size | null>(null);
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((s) => (s && s.w === width && s.h === height ? s : { w: width, h: height }));
  };
  const w = size?.w ?? win.width;
  const h = size?.h ?? win.height;

  if (themeId === 'classic' && !preview) return <Background />;

  return (
    <View style={[StyleSheet.absoluteFill, styles.clip]} pointerEvents="none" onLayout={onLayout}>
      {themeId === 'neon' && <NeonScene w={w} h={h} />}
      {themeId === 'space' && <SpaceScene w={w} h={h} />}
      {themeId === 'cyber' && <CyberScene w={w} h={h} />}
      {themeId === 'aurora' && <AuroraScene w={w} h={h} />}
      {themeId === 'abyss' && <AbyssScene w={w} h={h} />}
      {themeId === 'ember' && <EmberScene w={w} h={h} />}
      {!SCENES.includes(themeId) && <Background />}
    </View>
  );
}

export const ThemedBackdrop = memo(ThemedBackdropImpl);

const styles = StyleSheet.create({ clip: { overflow: 'hidden' } });
