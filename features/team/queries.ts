import "server-only";
import { cache } from "react";
import type { SquadDirectory } from "@/components/providers/squad-directory";
import { createClient } from "@/lib/supabase/server";
import type { Freelancer } from "@/types";

/** profileId → squads de todas as pessoas (a RLS de profile_squads libera leitura para quem está ativo). */
export const getSquadDirectory = cache(async (): Promise<SquadDirectory> => {
  const supabase = await createClient();
  const { data } = await supabase.from("profile_squads").select("profile_id, squad");
  const directory: SquadDirectory = {};
  for (const row of data ?? []) {
    (directory[row.profile_id] ??= []).push(row.squad);
  }
  return directory;
});

/** Freelancers cadastrados (sem conta). A RLS libera a leitura só para a equipe interna. */
export async function listFreelancers(options: { onlyActive?: boolean } = {}): Promise<Freelancer[]> {
  const supabase = await createClient();
  let query = supabase.from("freelancers").select("*").order("full_name");
  if (options.onlyActive) query = query.eq("is_active", true);
  const { data } = await query;
  return data ?? [];
}
