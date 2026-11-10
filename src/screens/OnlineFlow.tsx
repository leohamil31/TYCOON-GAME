import React from 'react';
import { View } from 'react-native';
import { CountdownOverlay, ResultOverlay } from '../components/BattleOverlays';
import { useBattle } from '../state/useBattle';
import { GameScreen } from './GameScreen';
import { LobbyScreen } from './LobbyScreen';

/** Lobby -> countdown -> match -> result, all driven by `useBattle`. */
export function OnlineFlow({ onExit }: { onExit: () => void }) {
  const b = useBattle();
  const inMatch = b.phase === 'countdown' || b.phase === 'playing' || b.phase === 'finished';

  const exit = () => {
    b.leave();
    onExit();
  };

  if (!inMatch) {
    return (
      <LobbyScreen
        phase={b.phase}
        role={b.role}
        code={b.code}
        error={b.error}
        me={b.me}
        opp={b.opp}
        onCreate={b.host}
        onJoin={b.join}
        onStart={b.start}
        onBack={exit}
      />
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <GameScreen
        key={b.round}
        mode="battle"
        onExit={exit}
        battle={{ me: b.me, opp: b.opp, timeLeft: b.timeLeft, onLocalUpdate: b.sendState }}
      />
      {b.phase === 'countdown' && <CountdownOverlay count={b.count} oppName={b.opp?.name ?? 'Amigo'} />}
      {b.phase === 'finished' && b.result && (
        <ResultOverlay
          result={b.result}
          myName={b.me.name}
          oppName={b.opp?.name ?? 'Amigo'}
          isHost={b.role === 'host'}
          canRematch={b.role === 'host' && !!b.opp}
          friendLeft={!b.opp}
          onRematch={b.start}
          onExit={exit}
        />
      )}
    </View>
  );
}
