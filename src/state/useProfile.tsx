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

  const value = useMemo<ProfileCtx>(
    () => ({
      profile,
      friends,
      mode: backend.mode,
      loading,
      loadError,
      reload: () => setAttempt((n) => n + 1),
      setLiveScore: (s) => {
        liveScore.current = s;
      },
      reportRun: (runId, score) => run(() => backend.reportRun(runId, score)),
      purchase: (itemId, qty) => run(() => backend.purchase(itemId, qty)),
      simulatedIap: (sku) => run(() => backend.simulatedIap(sku)),
      equipBoard: (boardId) => run(() => backend.equipBoard(boardId)),
      consume: (itemId) => run(() => backend.consume(itemId)),
      rename: (name) => run(() => backend.setName(name)),
      refreshFriends,
      addFriend: async (code) => {
        try {
          setFriends(await backend.addFriend(code));
          return null;
        } catch (e) {
          return messageOf(e);
        }
      },
      removeFriend: async (code) => {
        try {
          setFriends(await backend.removeFriend(code));
          return null;
        } catch (e) {
          return messageOf(e);
        }
      },
    }),
    [profile, friends, loading, loadError, run, refreshFriends],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProfile(): ProfileCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useProfile precisa estar dentro de <ProfileProvider>');
  return v;
}
