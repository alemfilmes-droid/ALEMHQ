import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";
import { applyRememberPolicy, REMEMBER_COOKIE } from "@/lib/supabase/cookies";
import type { Database } from "@/types/database";

/** Renova a sessão e devolve o usuário validado junto com a resposta que carrega os cookies. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const remember = request.cookies.get(REMEMBER_COOKIE)?.value !== "0";

  const supabase = createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, applyRememberPolicy(options, remember));
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabase, user, getResponse: () => response };
}
