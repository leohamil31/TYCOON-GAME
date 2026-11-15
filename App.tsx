import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StatusBar, StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { InviteBanner } from './src/components/InviteBanner';
import { LevelUpBanner } from './src/components/LevelUpBanner';
import { GameScreen } from './src/screens/GameScreen';
import { MenuScreen } from './src/screens/MenuScreen';
import { OnlineFlow, type OnlineStart } from './src/screens/OnlineFlow';
import { ProfileProvider } from './src/state/useProfile';
import { ProgressProvider } from './src/state/useProgress';
import { PALETTE, USE_NATIVE_DRIVER } from './src/theme';

type Screen = 'menu' | 'solo' | 'online';

/** Entrada suave de cada tela (fade + leve subida), 220ms. */
function ScreenFade({ children }: { children: React.ReactNode }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: USE_NATIVE_DRIVER }).start();
  }, [v]);
  return (
    <Animated.View
      style={{ flex: 1, opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }}
    >
      {children}
    </Animated.View>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  /** Como a batalha começa: lobby normal, desafio a um amigo ou aceitando um convite. */
  const [start, setStart] = useState<OnlineStart>({ kind: 'lobby' });
  /** Muda a cada entrada na batalha para remontar o fluxo do zero. */
  const [visit, setVisit] = useState(0);
  const toMenu = () => setScreen('menu');
  const goOnline = (s: OnlineStart) => {
    setStart(s);
    setVisit((n) => n + 1);
    setScreen('online');
  };

  return (
    <SafeAreaProvider>
      <ProfileProvider>
        <ProgressProvider>
        {/* SafeAreaView de react-native-safe-area-context: o do react-native foi descontinuado e não funciona no Android. */}
        <SafeAreaView style={styles.root} edges={['top', 'bottom', 'left', 'right']}>
          <StatusBar barStyle="light-content" />
          <ScreenFade key={screen === 'online' ? `online-${visit}` : screen}>
          {screen === 'menu' && (
            <MenuScreen
              onSolo={() => setScreen('solo')}
              onOnline={() => goOnline({ kind: 'lobby' })}
              onChallenge={(code, name) => goOnline({ kind: 'challenge', friendCode: code, friendName: name })}
            />
          )}
          {screen === 'solo' && <GameScreen mode="solo" onExit={toMenu} />}
          {screen === 'online' && <OnlineFlow key={visit} start={start} onExit={toMenu} />}
          </ScreenFade>
          <InviteBanner busy={screen === 'online'} onAccept={(inv) => goOnline({ kind: 'join', room: inv.room, friendName: inv.name })} />
          <LevelUpBanner />
        </SafeAreaView>
        </ProgressProvider>
      </ProfileProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PALETTE.void },
});
