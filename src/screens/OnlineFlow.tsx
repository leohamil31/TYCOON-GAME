import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { CountdownOverlay, ResultOverlay } from '../components/BattleOverlays';
import { coinsForScore } from '../shop/catalog';
import { useBattle } from '../state/useBattle';
import { useProfile } from '../state/useProfile';
import { GameScreen } from './GameScreen';
import { LobbyScreen } from './LobbyScreen';

/** Lobby -> countdown -> match -> result, all driven by `useBattle`. */
export function OnlineFlow({ onExit }: { onExit: () => void }) {
  const b = useBattle();
  const { reportRun } = useProfile();
  const inMatch = b.phase === 'countdown' || b.phase === 'playing' || b.phase === 'finished';

  // Batalhas também rendem moedas (creditadas uma vez por partida), para comprar itens na loja.
  const paid = useRef<string | null>(null);
  useEffect(() => {
    if (!b.result || !b.matchId || paid.current === b.matchId) return;
    paid.current = b.matchId;
    void reportRun(b.matchId, b.result.myScore);
  }, [b.result, b.matchId, reportRun]);

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
        battle={{
          me: b.me,
          opp: b.opp,
          timeLeft: b.timeLeft,
          locked: b.phase !== 'playing',
          onLocalUpdate: b.sendState,
        }}
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
          coins={coinsForScore(b.result.myScore)}
          onRematch={b.start}
          onExit={exit}
        />
      )}
    </View>
  );
}
