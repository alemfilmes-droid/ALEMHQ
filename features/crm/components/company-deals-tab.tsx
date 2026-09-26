import { DealStageBadge } from "@/features/crm/components/deal-stage-badge";
import { listDealsByCompany } from "@/features/crm/queries";
import { formatCents, toCents } from "@/features/finance/money";
import { formatDate } from "@/lib/format";

/** Histórico comercial da empresa (aba "Comercial" da página de cliente) — ganhos, perdidos e em aberto. */
export async function CompanyDealsTab({ companyId, canSeeFinance }: { companyId: string; canSeeFinance: boolean }) {
  const deals = await listDealsByCompany(companyId);

  if (deals.length === 0) {
    return <p className="rounded-lg border border-dashed border-border-strong p-6 text-sm text-muted-foreground">Nenhum negócio registrado para esta empresa.</p>;
  }

  return (
    <ul className="divide-y divide-border rounded-lg border border-border bg-card">
      {deals.map((deal) => (
        <li key={deal.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
          <span className="flex min-w-0 flex-1 basis-48 items-center gap-2">
            <span className="truncate text-sm font-bold">{deal.title}</span>
          </span>
          <DealStageBadge stage={deal.stage!} />
          <span className="text-[13px] text-muted-foreground">{deal.owner_name}</span>
          {canSeeFinance ? (
            <span className="text-[13px] font-semibold tabular-nums" data-sensitive>
              {deal.estimated_value != null ? formatCents(toCents(deal.estimated_value)) : "—"}
            </span>
          ) : null}
          <span className="text-[13px] text-muted-foreground">{formatDate(deal.created_at!)}</span>
        </li>
      ))}
    </ul>
  );
}
