import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicEnv } from "@/lib/env";
import { applyRememberPolicy, REMEMBER_COOKIE } from "@/lib/supabase/cookies";
import type { Database } from "@/types/database";

export async function createClient() {
  const cookieStore = await cookies();
  const remember = cookieStore.get(REMEMBER_COOKIE)?.value !== "0";

  return createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, applyRememberPolicy(options, remember));
            }
          } catch {
            // Chamado de um Server Component: o middleware já renova a sessão.
          }
        },
      },
    },
  );
}
