import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Servidor gratuito (Supabase): perfis, amigos, loja e salas de batalha em tempo real.
 * A chave PUBLICÁVEL pode ficar no app; a segurança vem das regras (RLS) e funções em supabase/schema.sql.
 * NUNCA coloque a chave secreta (sb_secret_...) aqui.
 * Deixe SUPABASE_URL vazio para voltar ao modo demonstração (tudo salvo só no aparelho).
 */
export const SUPABASE_URL = '';
export const SUPABASE_KEY = 'sb_publishable_qoJjBU7C3ZtiwedouCDXMQ_MjGAhSoT';

export const supabase: SupabaseClient | null = SUPABASE_URL
  ? createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        storage: AsyncStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
      realtime: { params: { eventsPerSecond: 20 } },
    })
  : null;

/** Garante uma sessão (login anônimo na primeira vez; depois reaproveita a salva no aparelho). */
export async function ensureSession(sb: SupabaseClient): Promise<void> {
  const { data } = await sb.auth.getSession();
  if (data.session) return;
  const { error } = await sb.auth.signInAnonymously();
  if (error) throw error;
}
