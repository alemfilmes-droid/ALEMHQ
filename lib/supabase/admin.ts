import "server-only";
import { createClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env.server";
import type { Database } from "@/types/database";

/**
 * Cliente com service role: ignora RLS. Somente servidor (server actions,
 * route handlers). Nunca importe em componentes de cliente.
 */
export function createAdminClient() {
  return createClient<Database>(serverEnv.NEXT_PUBLIC_SUPABASE_URL, serverEnv.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
