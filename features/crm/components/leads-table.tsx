"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ClientAvatar } from "@/components/companies/client-avatar";
import { Inbox } from "lucide-react";
import { toast } from "sonner";
import { reassignOwnerAction } from "@/features/crm/actions";
import { useCrmFlow } from "@/features/crm/components/flow/crm-flow-provider";
import { DealStageBadge } from "@/features/crm/components/deal-stage-badge";
import { DEAL_STAGE_LABELS, PROSPECTION_GOAL_LABELS, TEMPERATURE_LABELS, type Temperature } from "@/features/crm/labels";
import type { DealFormOptions } from "@/features/crm/types";
import { CsvExportButton } from "@/features/finance/components/csv-export-button";
import { EmptyState, TableShell, Th } from "@/features/finance/components/table-shell";
import { centsToInput, formatCents, toCents } from "@/features/finance/money";
import { UserAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { NativeSelect } from "@/components/ui/native-select";
import { StatusDot } from "@/components/ui/status-dot";
import { formatDate } from "@/lib/format";
import { TEMPERATURE_TONE } from "@/lib/status";
import type { DealWithDetails } from "@/types";

interface LeadsTableProps {
  deals: DealWithDetails[];
  options: DealFormOptions;
  canManageAll: boolean;
}

export function LeadsTable({ deals, options, canManageAll }: LeadsTableProps) {
  const flow = useCrmFlow();
  const [selected, setSelected] = useState<string[]>([]);
  const [reassignOwner, setReassignOwner] = useState("");
  const [pending, startTransition] = useTransition();

  if (deals.length === 0) {
    return <EmptyState icon={Inbox} title="Nenhum negócio encontrado." hint="Ajuste os filtros ou crie um novo negócio." />;
  }

  function toggle(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function reassign() {
    if (!reassignOwner || selected.length === 0) return;
    startTransition(async () => {
      const result = await reassignOwnerAction({ dealIds: selected, ownerId: reassignOwner });
      if (result.ok) {
        toast.success(result.message);
        setSelected([]);
        setReassignOwner("");
      } else {
        toast.error(result.error);
      }
    });
  }

  const csvHeaders = [
    "Código",
    "Empresa",
    "Título",
    "Etapa",
    "Objetivo",
    "SDR",
    "Responsável atual",
    ...(flow.canSeeFinance ? ["Valor estimado", "Comissão"] : []),
    "Temperatura",
    "Previsão de fechamento",
    "Próxima ação",
  ];
  const csvRows = deals.map((deal) => [
    deal.code ?? "",
    deal.company_name ?? "",
    deal.title ?? "",
    DEAL_STAGE_LABELS[deal.stage!],
    (deal.prospection_goals ?? []).map((goal) => PROSPECTION_GOAL_LABELS[goal]).join(", "),
    deal.owner_name ?? "",
    deal.responsible_name ?? "",
    ...(flow.canSeeFinance
      ? [
          deal.estimated_value != null ? centsToInput(toCents(deal.estimated_value)) : "",
          deal.commission_amount != null && deal.stage !== "perdido" ? centsToInput(toCents(deal.commission_amount)) : "",
        ]
      : []),
    TEMPERATURE_LABELS[(deal.temperature ?? "neutral") as Temperature],
    deal.expected_close_date ? formatDate(deal.expected_close_date) : "",
    deal.next_action ?? "",
  ]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {canManageAll && selected.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-semibold text-muted-foreground">{selected.length} selecionado(s)</span>
            <NativeSelect aria-label="Novo SDR" className="w-56" value={reassignOwner} onChange={(event) => setReassignOwner(event.target.value)}>
              <option value="">Novo SDR responsável</option>
              {options.members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.full_name}
                </option>
              ))}
            </NativeSelect>
            <Button type="button" size="sm" variant="secondary" disabled={!reassignOwner} loading={pending} onClick={reassign}>
              Reatribuir
            </Button>
          </div>
        ) : (
          <span />
        )}
        <CsvExportButton filename="negocios.csv" headers={csvHeaders} rows={csvRows} />
      </div>

      <TableShell minWidth="min-w-[1080px]">
        <thead>
          <tr>
            {canManageAll ? (
              <th scope="col" className="w-10 border-b border-border px-4 py-3">
                <span className="sr-only">Selecionar</span>
              </th>
            ) : null}
            <Th>Empresa / negócio</Th>
            <Th>Etapa</Th>
            <Th>SDR</Th>
            <Th>Com a bola</Th>
            {flow.canSeeFinance ? <Th align="right">Valor estimado</Th> : null}
            {flow.canSeeFinance ? <Th align="right">Comissão</Th> : null}
            <Th>Próxima ação</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {deals.map((deal) => {
            const temperature = (deal.temperature ?? "neutral") as Temperature;
            const open = deal.stage !== "ganho" && deal.stage !== "perdido";
            return (
              <tr key={deal.id} className="cursor-pointer hover:bg-surface-hover" onClick={() => flow.openDeal(deal.id!)}>
                {canManageAll ? (
                  <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                    <Checkbox checked={selected.includes(deal.id!)} onCheckedChange={() => toggle(deal.id!)} aria-label={`Selecionar ${deal.title}`} />
                  </td>
                ) : null}
                <td className="px-4 py-3">
                  <Link
                    href={`/clientes/${deal.company_id}`}
                    className="inline-flex items-center gap-2 font-semibold hover:underline"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <ClientAvatar name={deal.company_name ?? "—"} logoUrl={deal.company_logo_url} size="sm" />
                    {deal.company_name}
                  </Link>
                  <span className="block text-[13px] text-muted-foreground">{deal.title}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-2">
                    <DealStageBadge stage={deal.stage!} />
                    {open ? <StatusDot tone={TEMPERATURE_TONE[temperature]} label={deal.temperature_reason ?? TEMPERATURE_LABELS[temperature]} /> : null}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-2">
                    <UserAvatar name={deal.owner_name ?? "—"} src={deal.owner_avatar_url} profileId={deal.owner_id} className="size-6" />
                    {deal.owner_name}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{deal.responsible_name ?? "—"}</td>
                {flow.canSeeFinance ? (
                  <td className="whitespace-nowrap px-4 py-3 text-right font-bold tabular-nums" data-sensitive>
                    {deal.estimated_value != null ? formatCents(toCents(deal.estimated_value)) : "—"}
                  </td>
                ) : null}
                {flow.canSeeFinance ? (
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-muted-foreground" data-sensitive>
                    {deal.commission_amount != null && deal.stage !== "perdido" ? formatCents(toCents(deal.commission_amount)) : "—"}
                  </td>
                ) : null}
                <td className="px-4 py-3 text-muted-foreground">
                  {open ? (
                    <>
                      {deal.next_action ?? "—"}
                      {deal.next_action_at ? <span className="block text-[12px]">{formatDate(deal.next_action_at)}</span> : null}
                    </>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </TableShell>
    </div>
  );
}
