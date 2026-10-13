import "server-only";
import { toCents } from "@/features/finance/money";
import { canReadAnyWallet } from "@/lib/auth/permissions";
import { todayInAppZone } from "@/lib/calendar";
import { createClient } from "@/lib/supabase/server";
import { buildWallet, type Remuneration, type WalletView } from "@/lib/wallet/wallet";
import type { ProfileWithSquads } from "@/types";

export interface WalletPage {
  person: { id: string; name: string };
  remuneration: Remuneration | null;
  view: WalletView;
  today: string;
  /** Quem pode ver a Carteira de outras pessoas: a lista para escolher. */
  people: { id: string; name: string }[];
}

export class WalletAccessError extends Error {
  constructor() {
    super("Você só pode ver a sua Carteira.");
  }
}

/**
 * Carteira de uma pessoa (a própria, ou de outra para master/admin/diretoria/financeiro). O banco confere de novo
 * (wallet_entries → can_read_wallet) e só devolve os pagamentos em que ela é a favorecida.
 */
export async function getWallet(viewer: ProfileWithSquads, personId: string | undefined): Promise<WalletPage> {
  const readsAny = canReadAnyWallet(viewer);
  const targetId = personId && personId !== viewer.id ? personId : viewer.id;
  if (targetId !== viewer.id && !readsAny) throw new WalletAccessError();

  const supabase = await createClient();
  const today = todayInAppZone();
  const [entries, remuneration, person, people] = await Promise.all([
    supabase.rpc("wallet_entries", { p_profile_id: targetId }),
    supabase.from("profile_remuneration").select("remuneration_type, fixed_amount_cents, payday, default_commission_percent").eq("profile_id", targetId).maybeSingle(),
    supabase.from("profiles").select("id, full_name").eq("id", targetId).maybeSingle(),
    readsAny
      ? supabase.from("profiles").select("id, full_name").eq("is_active", true).neq("full_name", "").order("full_name")
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ]);
  if (entries.error) throw entries.error.code === "42501" ? new WalletAccessError() : new Error("Falha ao carregar a Carteira.");

  const rem: Remuneration | null = remuneration.data
    ? {
        type: remuneration.data.remuneration_type,
        fixedAmountCents: remuneration.data.fixed_amount_cents,
        payday: remuneration.data.payday,
        defaultCommissionPercent: remuneration.data.default_commission_percent,
      }
    : null;

  const view = buildWallet(
    (entries.data ?? []).map((row) => ({
      id: row.id,
      description: row.description,
      amountCents: toCents(row.amount),
      dueDate: row.due_date,
      payoutDate: row.payout_date,
      paidAt: row.paid_at,
      companyName: row.company_name,
      projectName: row.project_name,
      goalTitle: row.goal_title,
      teamType: row.team_payment_type,
      category: row.category,
      isFixed: row.is_fixed,
      hasGoal: row.commission_goal_id !== null,
      hasProject: row.project_id !== null,
    })),
    rem,
    today,
  );

  return {
    person: { id: targetId, name: person.data?.full_name ?? "" },
    remuneration: rem,
    view,
    today,
    people: (people.data ?? []).map((row) => ({ id: row.id, name: row.full_name })),
  };
}
