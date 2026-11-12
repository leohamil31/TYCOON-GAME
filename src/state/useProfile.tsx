import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, backend } from '../services/api';
import { loadName } from '../storage';
import type { Friend, Profile } from '../shop/types';

/** Resultado de uma ação: mensagem de erro (para exibir) ou null em caso de sucesso. */
type Result = Promise<string | null>;

interface ProfileCtx {
  profile: Profile | null;
  friends: Friend[];
  /** 'remote' = API Node/PostgreSQL; 'local' = demonstração salva no aparelho. */
  mode: 'remote' | 'local';
  loading: boolean;
  loadError: string | null;
  reload: () => void;
  setLiveScore: (score: number) => void;
  reportRun: (runId: string, score: number) => Result;
  /** Resultado de batalha: moedas + vitória no ranking (cai para reportRun sem servidor). */
  reportBattle: (matchId: string, score: number, won: boolean) => Result;
  purchase: (itemId: string, qty?: number) => Result;
  simulatedIap: (sku: string) => Result;
  equipBoard: (boardId: string) => Result;
  consume: (itemId: string) => Result;
  refreshFriends: () => Promise<void>;
  addFriend: (code: string) => Result;
  removeFriend: (code: string) => Result;
  rename: (name: string) => Result;
}

const Ctx = createContext<ProfileCtx | null>(null);

const messageOf = (e: unknown) => (e instanceof ApiError ? e.message : 'Algo deu errado. Tente novamente.');

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const liveScore = useRef(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void (async () => {
      try {
        const p = await backend.init(await loadName());
        if (!alive) return;
        setProfile(p);
        setLoadError(null);
        setFriends(await backend.listFriends().catch(() => []));
      } catch (e) {
        if (alive) setLoadError(messageOf(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [attempt]);

  // Presença: avisa ao servidor que estamos online e qual a pontuação atual.
  const ready = !!profile;
  useEffect(() => {
    if (!ready) return;
    const beat = () => void backend.heartbeat(liveScore.current).catch(() => undefined);
    beat();
    const t = setInterval(beat, 10_000);
    return () => clearInterval(t);
  }, [ready]);

  const run = useCallback(async (fn: () => Promise<Profile>): Result => {
    try {
      setProfile(await fn());
      return null;
    } catch (e) {
      return messageOf(e);
    }
  }, []);

  const refreshFriends = useCallback(async () => {
    try {
      setFriends(await backend.listFriends());
    } catch {
      /* mantém a lista anterior */
    }
  }, []);

  // Ações estáveis (mesma identidade entre renders): evita que efeitos que dependem delas disparem em loop.
  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const setLiveScore = useCallback((sc: number) => {
    liveScore.current = sc;
  }, []);
  const reportRun = useCallback((runId: string, score: number) => run(() => backend.reportRun(runId, score)), [run]);
  const reportBattle = useCallback(
    (matchId: string, score: number, won: boolean) =>
      run(() => (backend.reportBattle ? backend.reportBattle(matchId, score, won) : backend.reportRun(matchId, score))),
    [run],
  );
  const purchase = useCallback((itemId: string, qty?: number) => run(() => backend.purchase(itemId, qty)), [run]);
  const simulatedIap = useCallback((sku: string) => run(() => backend.simulatedIap(sku)), [run]);
  const equipBoard = useCallback((boardId: string) => run(() => backend.equipBoard(boardId)), [run]);
  const consume = useCallback((itemId: string) => run(() => backend.consume(itemId)), [run]);
  const rename = useCallback((name: string) => run(() => backend.setName(name)), [run]);
  const addFriend = useCallback(async (code: string) => {
    try {
      setFriends(await backend.addFriend(code));
      return null;
    } catch (e) {
      return messageOf(e);
    }
  }, []);
  const removeFriend = useCallback(async (code: string) => {
    try {
      setFriends(await backend.removeFriend(code));
      return null;
    } catch (e) {
      return messageOf(e);
    }
  }, []);

  const value = useMemo<ProfileCtx>(
    () => ({
      profile,
      friends,
      mode: backend.mode,
      loading,
      loadError,
      reload,
      setLiveScore,
      reportRun,
      reportBattle,
      purchase,
      simulatedIap,
      equipBoard,
      consume,
      rename,
      refreshFriends,
      addFriend,
      removeFriend,
    }),
    [profile, friends, loading, loadError, reload, setLiveScore, reportRun, reportBattle, purchase, simulatedIap, equipBoard, consume, rename, refreshFriends, addFriend, removeFriend],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProfile(): ProfileCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useProfile precisa estar dentro de <ProfileProvider>');
  return v;
}
