import React, { memo, useEffect, useRef } from 'react';
import { Animated, Easing, Text, View, type TextStyle } from 'react-native';
import { USE_NATIVE_DRIVER } from '../theme';

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

interface DigitProps {
  digit: number;
  h: number;
  w: number;
  fontSize: number;
  color: string;
  glow?: string;
}

/** One column of 0-9 that slides vertically to the target digit. */
function Digit({ digit, h, w, fontSize, color, glow }: DigitProps) {
  const y = useRef(new Animated.Value(-digit * h)).current;

  useEffect(() => {
    Animated.timing(y, {
      toValue: -digit * h,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [digit, h, y]);

  const text: TextStyle = {
    height: h,
    lineHeight: h,
    width: w,
    textAlign: 'center',
    fontSize,
    fontWeight: '900',
    color,
    ...(glow ? { textShadowColor: glow, textShadowRadius: 12, textShadowOffset: { width: 0, height: 0 } } : null),
  };

  return (
    <View style={{ width: w, height: h, overflow: 'hidden' }}>
      <Animated.View style={{ transform: [{ translateY: y }] }}>
        {DIGITS.map((d) => (
          <Text key={d} style={text}>
            {d}
          </Text>
        ))}
      </Animated.View>
    </View>
  );
}

interface Props {
  value: number;
  fontSize?: number;
  color?: string;
  glow?: string;
}

/** Rolling-number counter (odometer): digits scroll when the value changes and the whole number pops. */
export const Odometer = memo(function Odometer({ value, fontSize = 36, color = '#fff', glow }: Props) {
  const pop = useRef(new Animated.Value(1)).current;
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    pop.setValue(1.16);
    Animated.spring(pop, { toValue: 1, friction: 4, tension: 170, useNativeDriver: USE_NATIVE_DRIVER }).start();
  }, [value, pop]);

  const h = Math.round(fontSize * 1.2);
  const w = Math.round(fontSize * 0.62);
  const chars = String(Math.max(0, Math.floor(value))).split('');

  return (
    <Animated.View style={{ flexDirection: 'row', transform: [{ scale: pop }] }}>
      {chars.map((ch, i) => (
        <Digit
          key={chars.length - 1 - i}
          digit={Number(ch)}
          h={h}
          w={w}
          fontSize={fontSize}
          color={color}
          glow={glow}
        />
      ))}
    </Animated.View>
  );
});
