import React, { useState } from 'react';
import { StatusBar, StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { GameScreen } from './src/screens/GameScreen';
import { MenuScreen } from './src/screens/MenuScreen';
import { OnlineFlow } from './src/screens/OnlineFlow';
import { ProfileProvider } from './src/state/useProfile';
import { PALETTE } from './src/theme';

type Screen = 'menu' | 'solo' | 'online';

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const toMenu = () => setScreen('menu');

  return (
    <SafeAreaProvider>
      <ProfileProvider>
        {/* SafeAreaView de react-native-safe-area-context: o do react-native foi descontinuado e não funciona no Android. */}
        <SafeAreaView style={styles.root} edges={['top', 'bottom', 'left', 'right']}>
          <StatusBar barStyle="light-content" backgroundColor={PALETTE.void} />
          {screen === 'menu' && <MenuScreen onSolo={() => setScreen('solo')} onOnline={() => setScreen('online')} />}
          {screen === 'solo' && <GameScreen mode="solo" onExit={toMenu} />}
          {screen === 'online' && <OnlineFlow onExit={toMenu} />}
        </SafeAreaView>
      </ProfileProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PALETTE.void },
});
