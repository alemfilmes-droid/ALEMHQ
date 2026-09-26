import "server-only";
import { cache } from "react";
import type { SquadDirectory } from "@/components/providers/squad-directory";
import { createClient } from "@/lib/supabase/server";

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
