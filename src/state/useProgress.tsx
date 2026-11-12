import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { backend } from '../services/api';
import type { ChestReward, DailyState, MissionEvents } from '../shop/types';
import { useProfile } from './useProfile';

/** Mensagem de erro amigável de qualquer exceção. */
const msgOf = (e: unknown) => (e as { message?: string } | null)?.message ?? 'Algo deu errado.';

interface ProgressCtx {
  /** Disponível só com servidor (Supabase). */
  enabled: boolean;
  daily: DailyState | null;
  refresh: () => Promise<void>;
  /** Junta eventos da partida e envia (com atraso curto, para agrupar). */
  track: (events: MissionEvents) => void;
  /** Envia já o que estiver pendente (fim de partida). */
  flush: () => Promise<void>;
  claimDaily: () => Promise<{ coins: number; chest: boolean; streak: number } | string>;
  claimMission: (id: string) => Promise<string | null>;
  openChest: () => Promise<ChestReward | string>;
  /** Último "subiu de nível" visto (para a celebração). */
  levelUp: number | null;
  clearLevelUp: () => void;
}

const Ctx = createContext<ProgressCtx | null>(null);

/** Missões diárias, recompensa diária, níveis e baús. Fica abaixo do ProfileProvider. */
export function ProgressProvider({ children }: { children: React.ReactNode }) {
  const { profile, mode, applyProfile } = useProfile();
  const enabled = mode === 'remote' && !!backend.dailyState;
  const [daily, setDaily] = useState<DailyState | null>(null);
  const [levelUp, setLevelUp] = useState<number | null>(null);
  const pending = useRef<MissionEvents>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Detecta subida de nível em qualquer atualização do perfil (partida, missão, batalha...).
  const lastLevel = useRef<number | null>(null);
  useEffect(() => {
    const lvl = profile?.level;
    if (lvl === undefined) return;
    if (lastLevel.current !== null && lvl > lastLevel.current) setLevelUp(lvl);
    lastLevel.current = lvl;
  }, [profile?.level]);

  const take = useCallback(
    (d: DailyState) => {
      setDaily(d);
      applyProfile(d.profile);
    },
    [applyProfile],
  );

  const refresh = useCallback(async () => {
    if (!enabled || !backend.dailyState) return;
    try {
      take(await backend.dailyState());
    } catch {
      /* mantém o último estado */
    }
  }, [enabled, take]);

  useEffect(() => {
    if (enabled && profile?.userId) void refresh();
  }, [enabled, profile?.userId, refresh]);

  // Partidas, batalhas e rankings mudam missões no servidor: atualiza quando moedas/recorde/vitórias mudam.
  useEffect(() => {
    if (!enabled) return;
    const t = setTimeout(() => void refresh(), 600);
    return () => clearTimeout(t);
  }, [enabled, profile?.best, profile?.wins, profile?.battles, profile?.xp, refresh]);

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const ev = pending.current;
    pending.current = {};
    if (!enabled || !backend.missionEvent || Object.values(ev).every((n) => !n)) return;
    try {
      take(await backend.missionEvent(ev));
    } catch {
      // devolve para a próxima tentativa
      Object.entries(ev).forEach(([k, n]) => {
        const key = k as keyof MissionEvents;
        pending.current[key] = (pending.current[key] ?? 0) + (n ?? 0);
      });
    }
  }, [enabled, take]);

  const track = useCallback(
    (events: MissionEvents) => {
      if (!enabled) return;
      Object.entries(events).forEach(([k, n]) => {
        const key = k as keyof MissionEvents;
        pending.current[key] = (pending.current[key] ?? 0) + (n ?? 0);
      });
      if (!timer.current) timer.current = setTimeout(() => void flush(), 4000);
    },
    [enabled, flush],
  );

  const claimDaily = useCallback(async () => {
    if (!backend.claimDaily) return 'Precisa do servidor.';
    try {
      const r = await backend.claimDaily();
      applyProfile(r.profile);
      void refresh();
      return { coins: r.coins, chest: r.chest, streak: r.streak };
    } catch (e) {
      return msgOf(e);
    }
  }, [applyProfile, refresh]);

  const claimMission = useCallback(
    async (id: string) => {
      if (!backend.claimMission) return 'Precisa do servidor.';
      try {
        take(await backend.claimMission(id));
        return null;
      } catch (e) {
        return msgOf(e);
      }
    },
    [take],
  );

  const openChest = useCallback(async () => {
    if (!backend.openChest) return 'Precisa do servidor.';
    try {
      const r = await backend.openChest();
      applyProfile(r.profile);
      return r.reward;
    } catch (e) {
      return msgOf(e);
    }
  }, [applyProfile]);

  const clearLevelUp = useCallback(() => setLevelUp(null), []);

  const value = useMemo<ProgressCtx>(
    () => ({ enabled, daily, refresh, track, flush, claimDaily, claimMission, openChest, levelUp, clearLevelUp }),
    [enabled, daily, refresh, track, flush, claimDaily, claimMission, openChest, levelUp, clearLevelUp],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProgress(): ProgressCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useProgress fora do ProgressProvider');
  return c;
}
