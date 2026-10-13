import { canReadAnyWallet } from "@/lib/auth/permissions";
import type { ProfileWithSquads } from "@/types";

/**
 * De quem é a Carteira que a tela vai ler. Cada pessoa lê só a sua; master, admin, diretoria e financeiro escolhem
 * qualquer uma. O banco confere de novo (can_read_wallet em wallet_entries / wallet_ledger e na RLS do extrato).
 */

export class WalletAccessError extends Error {
  constructor() {
    super("Você só pode ver a sua Carteira.");
  }
}

export type WalletViewer = Pick<ProfileWithSquads, "id" | "access_role" | "org_level" | "squads">;

export function walletTarget(viewer: WalletViewer, personId: string | undefined): { targetId: string; readsAny: boolean } {
  const readsAny = canReadAnyWallet(viewer);
  const targetId = personId && personId !== viewer.id ? personId : viewer.id;
  if (targetId !== viewer.id && !readsAny) throw new WalletAccessError();
  return { targetId, readsAny };
}
