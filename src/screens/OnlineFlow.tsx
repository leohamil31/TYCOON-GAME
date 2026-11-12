import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { CountdownOverlay, ResultOverlay } from '../components/BattleOverlays';
import { sendInvite } from '../services/invites';
import { coinsForScore } from '../shop/catalog';
import { useBattle } from '../state/useBattle';
import { useProfile } from '../state/useProfile';
import { GameScreen } from './GameScreen';
import { LobbyScreen } from './LobbyScreen';

export type OnlineStart =
  | { kind: 'lobby' }
  /** Criar sala e mandar convite para um amigo. */
  | { kind: 'challenge'; friendCode: string; friendName: string }
  /** Entrar direto na sala de um convite aceito. */
  | { kind: 'join'; room: string; friendName: string };

/** Lobby -> countdown -> match -> result, all driven by `useBattle`. */
export function OnlineFlow({ onExit, start = { kind: 'lobby' } }: { onExit: () => void; start?: OnlineStart }) {
  const b = useBattle();
  const { reportBattle, profile } = useProfile();
  const [notice, setNotice] = useState<string | null>(null);
  const myName = profile?.name ?? 'Jogador';

  // Desafio/convite: cria ou entra na sala automaticamente.
  const started = useRef(false);
  useEffect(() => {
    if (started.current || start.kind === 'lobby') return;
    started.current = true;
    if (start.kind === 'challenge') {
      setNotice(`Enviando convite para ${start.friendName}…`);
      void b.host(myName);
    } else {
      setNotice(`Entrando na sala de ${start.friendName}…`);
      void b.join(start.room, myName);
    }
  }, [start, b, myName]);

  // Assim que a sala existe, manda o convite ao amigo.
  const invited = useRef(false);
  useEffect(() => {
    if (start.kind !== 'challenge' || invited.current || b.phase !== 'lobby' || !b.code || !profile) return;
    invited.current = true;
    sendInvite(start.friendCode, { from: profile.userId, name: profile.name, room: b.code })
      .then(() => setNotice(`Convite enviado! Esperando ${start.friendName} aceitar…`))
      .catch(() => setNotice(`Não deu para enviar o convite. Mande o código ${b.code} para ${start.friendName}.`));
  }, [start, b.phase, b.code, profile]);
  useEffect(() => {
    if (b.opp) setNotice(null);
  }, [b.opp]);
  const inMatch = b.phase === 'countdown' || b.phase === 'playing' || b.phase === 'finished';

  // Batalhas também rendem moedas (creditadas uma vez por partida), para comprar itens na loja.
  const paid = useRef<string | null>(null);
  useEffect(() => {
    if (!b.result || !b.matchId || paid.current === b.matchId) return;
    paid.current = b.matchId;
    void reportBattle(b.matchId, b.result.myScore, b.result.outcome === 'win');
  }, [b.result, b.matchId, reportBattle]);

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
        notice={notice}
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
          incoming: b.incoming,
          sendAttack: b.sendAttack,
          ackAttacks: b.ackAttacks,
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
