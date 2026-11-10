import React, { useState } from 'react';
import { SafeAreaView, StatusBar, StyleSheet } from 'react-native';
import { COLORS } from './src/constants';
import { GameScreen } from './src/screens/GameScreen';
import { MenuScreen } from './src/screens/MenuScreen';
import { OnlineFlow } from './src/screens/OnlineFlow';
import { ProfileProvider } from './src/state/useProfile';

type Screen = 'menu' | 'solo' | 'online';

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const toMenu = () => setScreen('menu');

  return (
    <ProfileProvider>
      <SafeAreaView style={styles.root}>
        <StatusBar barStyle="light-content" />
        {screen === 'menu' && <MenuScreen onSolo={() => setScreen('solo')} onOnline={() => setScreen('online')} />}
        {screen === 'solo' && <GameScreen mode="solo" onExit={toMenu} />}
        {screen === 'online' && <OnlineFlow onExit={toMenu} />}
      </SafeAreaView>
    </ProfileProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
});
