import { toast } from "sonner";
import type { PautaWithDetails } from "@/types";

/** Pauta espelho de um negócio: coluna, responsável e prazo vêm do CRM (trigger no banco). */
export function isCrmPauta(pauta: Pick<PautaWithDetails, "source" | "deal_id">): boolean {
  return pauta.source === "crm" && Boolean(pauta.deal_id);
}

export function crmDealHref(dealId: string): string {
  return `/crm?negocio=${dealId}`;
}

export const CRM_LOCK_MESSAGE = "A etapa desta pauta é definida no CRM";

/** Arrasto recusado: explica e oferece abrir o negócio (o banco recusaria do mesmo jeito). */
export function notifyCrmLock(pauta: Pick<PautaWithDetails, "deal_id">, navigate: (href: string) => void) {
  const dealId = pauta.deal_id;
  toast.error(`${CRM_LOCK_MESSAGE}.`, {
    description: "Mude a etapa no negócio e a pauta acompanha sozinha.",
    action: dealId ? { label: "Abrir negócio", onClick: () => navigate(crmDealHref(dealId)) } : undefined,
  });
}
