import "server-only";
import type { DeletionCounts } from "@/lib/clients/deletion";
import { createClient } from "@/lib/supabase/server";

export interface TrashItem {
  id: string;
  name: string;
  logo_url: string | null;
  deleted_at: string;
  deleted_by: string | null;
  reason: string | null;
  anonymized_at: string | null;
  counts: DeletionCounts & { can_purge: boolean };
}

/** Clientes na Lixeira (só a conta master; a função do banco confere). */
export async function listTrash(): Promise<TrashItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("client_trash_list");
  if (error) throw new Error("Falha ao carregar a Lixeira.");
  return (data ?? []) as unknown as TrashItem[];
}
