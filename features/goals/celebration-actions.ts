"use server";

import { z } from "zod";
import { toCents } from "@/features/finance/money";
import { getCurrentProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export interface Celebration {
  id: string;
  amount: number;
  goalTitle: string | null;
  fullName: string;
}

/** A comissão mais antiga ainda não comemorada da própria pessoa (a RLS só devolve as dela). */
export async function nextCelebrationAction(): Promise<Celebration | null> {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("commission_celebrations")
    .select("id, amount, goal_title")
    .is("seen_at", null)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  return data ? { id: data.id, amount: toCents(data.amount), goalTitle: data.goal_title, fullName: profile.full_name } : null;
}

/** "Fechar": não aparece de novo. */
export async function celebrationSeenAction(id: string): Promise<void> {
  if (!z.string().uuid().safeParse(id).success) return;
  const supabase = await createClient();
  await supabase.rpc("commission_celebration_seen", { p_id: id });
}
