"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Ban } from "lucide-react";
import { toast } from "sonner";
import { closeClientAction, getClosurePreviewAction, type ClosurePreview } from "@/features/clients/closure-actions";
import { CLOSURE_REASONS, CLOSURE_REASON_LABELS, PROSPECT_POTENTIALS, PROSPECT_POTENTIAL_LABELS, closureHealth } from "@/features/clients/closures";
import { toCents } from "@/features/finance/money";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Money } from "@/components/ui/money";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { LIFECYCLE_LABELS, STAGE_LABELS } from "@/lib/domain";
import { formatDate } from "@/lib/format";
import { todayInFortaleza } from "@/lib/pautas";
import { CLIENT_HEALTH_LABELS } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { ClosureReason, ProspectPotential } from "@/types";

interface CloseClientDialogProps {
  companyId: string;
  companyName: string;
  /** Preenchido: encerra só este projeto (o cliente continua). */
  project?: { id: string; name: string };
}

type YesNo = "sim" | "nao" | "";

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

function YesNoQuestion({ id, label, value, onChange }: { id: string; label: string; value: YesNo; onChange: (value: YesNo) => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p id={id} className="text-sm font-semibold">
        {label}
      </p>
      <div className="flex gap-2" role="radiogroup" aria-labelledby={id}>
        {(
          [
            ["sim", "Sim"],
            ["nao", "Não"],
          ] as const
        ).map(([option, text]) => (
          <Button
            key={option}
            type="button"
            size="sm"
            variant="secondary"
            role="radio"
            aria-checked={value === option}
            className={cn(value === option && "border-foreground bg-surface-hover font-bold text-foreground")}
            onClick={() => onChange(option)}
          >
            {text}
          </Button>
        ))}
      </div>
    </div>
  );
}

interface FinanceRow {
  id: string;
  description: string;
  due_date: string;
  project: string | null;
  amount: number | null;
  overdue: boolean;
  payee?: string | null;
  scheduled?: boolean;
}

/** Lista dos lançamentos em aberto: os futuros podem ser marcados como "continua pendente". */
function PendingPicker({
  rows,
  kept,
  onToggle,
  financeVisible,
  emptyLabel,
}: {
  rows: FinanceRow[];
  kept: string[];
  onToggle: (id: string) => void;
  financeVisible: boolean;
  emptyLabel: string;
}) {
  if (rows.length === 0) return <p className="text-[13px] text-muted-foreground">{emptyLabel}</p>;
  return (
    <ul className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border p-2">
      {rows.map((row) => {
        const locked = row.overdue || row.scheduled === true;
        return (
          <li key={row.id} className="flex items-start gap-2 text-[13px]">
            <Checkbox
              id={`keep-${row.id}`}
              className="mt-0.5"
              checked={locked || kept.includes(row.id)}
              disabled={locked}
              onCheckedChange={() => onToggle(row.id)}
            />
            <label htmlFor={`keep-${row.id}`} className="min-w-0 flex-1">
              <span className="font-semibold">{row.description}</span>
              <span className="text-muted-foreground">
                {" "}
                · vence {formatDate(row.due_date)}
                {row.project ? ` · ${row.project}` : ""}
                {row.payee ? ` · ${row.payee}` : ""}
              </span>
              {financeVisible && row.amount != null ? (
                <span className="text-muted-foreground">
                  {" "}
                  · <Money cents={toCents(row.amount)} />
                </span>
              ) : null}
              {row.overdue ? <span className="block text-[12px] text-subtle">Venceu antes do encerramento: continua em aberto.</span> : null}
              {row.scheduled && !row.overdue ? <span className="block text-[12px] text-subtle">Já agendado no banco: continua em aberto.</span> : null}
            </label>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * "Encerrar" cliente ou projeto (diretoria e master). Pergunta o motivo, o que aconteceu, a data e se
 * ainda há valores a receber/pagar — e mostra exatamente o que vai acontecer ANTES de confirmar. A
 * cascata inteira roda no banco (close_client), numa transação só.
 */
export function CloseClientDialog({ companyId, companyName, project, trigger }: CloseClientDialogProps & { trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <span className="contents" onClick={() => setOpen(true)}>
        {trigger}
      </span>
      {open ? <CloseClientForm companyId={companyId} companyName={companyName} project={project} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function CloseClientForm({ companyId, companyName, project, onClose }: CloseClientDialogProps & { onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState<ClosureReason | "">("");
  const [description, setDescription] = useState("");
  const [closedAt, setClosedAt] = useState(todayInFortaleza());
  const [receivables, setReceivables] = useState<YesNo>("");
  const [receivablesNote, setReceivablesNote] = useState("");
  const [keepReceivables, setKeepReceivables] = useState<string[]>([]);
  const [payables, setPayables] = useState<YesNo>("");
  const [payablesNote, setPayablesNote] = useState("");
  const [keepPayables, setKeepPayables] = useState<string[]>([]);
  const [potential, setPotential] = useState<ProspectPotential | "">("");
  const [notes, setNotes] = useState("");
  const [preview, setPreview] = useState<ClosurePreview | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(closedAt)) return;
    setPreview(undefined);
    getClosurePreviewAction(companyId, project?.id ?? null, closedAt).then((data) => {
      if (active) setPreview(data);
    });
    return () => {
      active = false;
    };
  }, [companyId, project?.id, closedAt]);

  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);

  // Prévia do resultado com as escolhas atuais (a mesma regra do banco).
  const futureReceivables = preview?.receivables.filter((row) => !row.overdue) ?? [];
  const keptReceivables = receivables === "sim" ? futureReceivables.filter((row) => keepReceivables.includes(row.id)) : [];
  const futurePayables = preview?.payables.filter((row) => !row.overdue && !row.scheduled) ?? [];
  const keptPayables = payables === "sim" ? futurePayables.filter((row) => keepPayables.includes(row.id)) : [];
  const overdueReceivables = preview?.receivables.filter((row) => row.overdue).length ?? 0;
  const lockedPayables = preview?.payables.filter((row) => row.overdue || row.scheduled).length ?? 0;
  const sum = (rows: FinanceRow[]) => rows.reduce((total, row) => total + (row.amount ?? 0), 0);
  const cancelledReceivables = futureReceivables.filter((row) => !keptReceivables.includes(row));
  const cancelledPayables = futurePayables.filter((row) => !keptPayables.includes(row));

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await closeClientAction({
        companyId,
        projectId: project?.id ?? "",
        reason: reason as ClosureReason,
        description,
        closedAt,
        hasPendingReceivables: receivables as "sim" | "nao",
        pendingReceivablesNote: receivablesNote,
        keepReceivableIds: receivables === "sim" ? keepReceivables : [],
        hasPendingPayables: payables as "sim" | "nao",
        pendingPayablesNote: payablesNote,
        keepPayableIds: payables === "sim" ? keepPayables : [],
        potential: potential as ProspectPotential,
        notes,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(result.message);
      onClose();
      router.refresh();
    });
  }

  const target = project ? `o projeto ${project.name}` : `o cliente ${companyName}`;

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex max-h-[90dvh] max-w-3xl flex-col">
        <DialogHeader>
          <DialogTitle>{project ? "Encerrar projeto." : "Encerrar cliente."}</DialogTitle>
          <DialogDescription>
            {project ? `${project.name} · ${companyName}` : companyName}. Confira o que vai acontecer antes de confirmar.
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-1 min-h-0 flex-1 space-y-6 overflow-y-auto px-1">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="closure-reason" label="Motivo">
              <NativeSelect id="closure-reason" value={reason} onChange={(event) => setReason(event.target.value as ClosureReason | "")}>
                <option value="" disabled>
                  Escolha o motivo
                </option>
                {CLOSURE_REASONS.map((item) => (
                  <option key={item} value={item}>
                    {CLOSURE_REASON_LABELS[item]}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField id="closure-date" label="Data do encerramento">
              <Input id="closure-date" type="date" value={closedAt} onChange={(event) => setClosedAt(event.target.value)} />
            </FormField>
          </div>
          <FormField id="closure-description" label="O que aconteceu" hint="Fica visível no cliente e no CRM para quem for abordar de novo.">
            <Textarea id="closure-description" rows={3} value={description} onChange={(event) => setDescription(event.target.value)} />
          </FormField>

          <section className="space-y-3 rounded-md border border-border p-3">
            <YesNoQuestion id="closure-receivables" label="Há valores a receber?" value={receivables} onChange={setReceivables} />
            {receivables === "sim" ? (
              <>
                <p className="text-[13px] text-muted-foreground">Marque os recebimentos que continuam valendo. Os demais recebimentos futuros serão cancelados.</p>
                {preview ? (
                  <PendingPicker
                    rows={preview.receivables}
                    kept={keepReceivables}
                    onToggle={(id) => setKeepReceivables((list) => toggle(list, id))}
                    financeVisible={preview.financeVisible}
                    emptyLabel="Nenhum recebimento em aberto lançado. Descreva abaixo o que ainda vai entrar."
                  />
                ) : null}
                <FormField id="closure-receivables-note" label="Quais e quando">
                  <Input id="closure-receivables-note" placeholder="Ex.: última parcela de outubro, dia 20" value={receivablesNote} onChange={(event) => setReceivablesNote(event.target.value)} />
                </FormField>
              </>
            ) : null}
          </section>

          <section className="space-y-3 rounded-md border border-border p-3">
            <YesNoQuestion id="closure-payables" label="Há custos a pagar?" value={payables} onChange={setPayables} />
            {payables === "sim" ? (
              <>
                <p className="text-[13px] text-muted-foreground">Marque os pagamentos que continuam valendo. Os demais pagamentos futuros do cliente serão cancelados.</p>
                {preview ? (
                  <PendingPicker
                    rows={preview.payables}
                    kept={keepPayables}
                    onToggle={(id) => setKeepPayables((list) => toggle(list, id))}
                    financeVisible={preview.financeVisible}
                    emptyLabel="Nenhum pagamento em aberto lançado. Descreva abaixo o que ainda vai sair."
                  />
                ) : null}
                <FormField id="closure-payables-note" label="Quais e quando">
                  <Input id="closure-payables-note" placeholder="Ex.: freelancer da última captação, dia 15" value={payablesNote} onChange={(event) => setPayablesNote(event.target.value)} />
                </FormField>
              </>
            ) : null}
          </section>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="closure-potential" label="Potencial de prospecção futura">
              <NativeSelect id="closure-potential" value={potential} onChange={(event) => setPotential(event.target.value as ProspectPotential | "")}>
                <option value="" disabled>
                  Vale abordar de novo?
                </option>
                {PROSPECT_POTENTIALS.map((item) => (
                  <option key={item} value={item}>
                    {PROSPECT_POTENTIAL_LABELS[item]}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField id="closure-notes" label="Observações" hint="Opcional.">
              <Input id="closure-notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
            </FormField>
          </div>

          <section aria-labelledby="closure-preview-title" className="space-y-2 rounded-md border border-border bg-surface-raised p-3">
            <h3 id="closure-preview-title" className="section-title">
              O que vai acontecer
            </h3>
            {preview === undefined ? (
              <Skeleton className="h-28 w-full" />
            ) : preview === null ? (
              <p className="text-sm text-muted-foreground">Não foi possível montar a prévia. Verifique a data e tente de novo.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {!project ? (
                  <li className="flex flex-wrap items-center gap-1.5">
                    <ArrowRight className="size-3.5 shrink-0" aria-hidden />
                    Cliente: {LIFECYCLE_LABELS[preview.company.lifecycle]} → <strong>{LIFECYCLE_LABELS.former_client}</strong>
                    {reason && closureHealth(reason, preview.company.health) !== preview.company.health
                      ? ` · saúde ${CLIENT_HEALTH_LABELS[preview.company.health]} → ${CLIENT_HEALTH_LABELS[closureHealth(reason, preview.company.health)]}`
                      : ""}
                  </li>
                ) : null}
                <li className="flex flex-wrap items-center gap-1.5">
                  <ArrowRight className="size-3.5 shrink-0" aria-hidden />
                  {preview.projects.length === 0 ? (
                    "Nenhum projeto ativo para encerrar."
                  ) : (
                    <span>
                      {plural(preview.projects.length, "projeto", "projetos")} → <strong>Encerrado</strong>:{" "}
                      {preview.projects.map((item) => `${item.name} (${STAGE_LABELS[item.stage]})`).join(", ")}
                    </span>
                  )}
                </li>
                <li className="flex flex-wrap items-center gap-1.5">
                  <ArrowRight className="size-3.5 shrink-0" aria-hidden />
                  {preview.pautas.length === 0 ? (
                    "Nenhuma pauta aberta nesses projetos."
                  ) : (
                    <span>
                      {plural(preview.pautas.length, "pauta aberta vai", "pautas abertas vão")} para Entregue como “Encerrado — {reason ? CLOSURE_REASON_LABELS[reason].toLowerCase() : "motivo"}”,
                      com o histórico preservado; os responsáveis são avisados.
                    </span>
                  )}
                </li>
                <li className="flex flex-wrap items-center gap-1.5">
                  <ArrowRight className="size-3.5 shrink-0" aria-hidden />
                  <span>
                    Recebimentos futuros: {plural(cancelledReceivables.length, "cancelado", "cancelados")}
                    {preview.financeVisible && cancelledReceivables.length ? (
                      <>
                        {" "}
                        (<Money cents={toCents(sum(cancelledReceivables))} />)
                      </>
                    ) : null}
                    {keptReceivables.length ? `, ${plural(keptReceivables.length, "mantido", "mantidos")} em aberto com nota` : ""}
                    {overdueReceivables ? `; ${plural(overdueReceivables, "vencido continua", "vencidos continuam")} em aberto` : ""}. O que já foi recebido não muda.
                  </span>
                </li>
                <li className="flex flex-wrap items-center gap-1.5">
                  <ArrowRight className="size-3.5 shrink-0" aria-hidden />
                  <span>
                    Pagamentos futuros: {plural(cancelledPayables.length, "cancelado", "cancelados")}
                    {preview.financeVisible && cancelledPayables.length ? (
                      <>
                        {" "}
                        (<Money cents={toCents(sum(cancelledPayables))} />)
                      </>
                    ) : null}
                    {keptPayables.length ? `, ${plural(keptPayables.length, "mantido", "mantidos")} em aberto com nota` : ""}
                    {lockedPayables ? `; ${plural(lockedPayables, "vencido ou agendado continua", "vencidos ou agendados continuam")} em aberto` : ""}. O que já foi pago não muda.
                  </span>
                </li>
                {preview.invoiceSchedules > 0 ? (
                  <li className="flex flex-wrap items-center gap-1.5">
                    <ArrowRight className="size-3.5 shrink-0" aria-hidden />
                    {plural(preview.invoiceSchedules, "agenda de nota fiscal desligada", "agendas de nota fiscal desligadas")}.
                  </li>
                ) : null}
                <li className="flex flex-wrap items-center gap-1.5">
                  <ArrowRight className="size-3.5 shrink-0" aria-hidden />
                  Previsão, fluxo de caixa e “Em negociação” deixam de contar {project ? "este projeto" : "este cliente"}
                  {!project && preview.openDeals > 0 ? ` (${plural(preview.openDeals, "negócio aberto", "negócios abertos")} no CRM continuam lá para decidir)` : ""}.
                </li>
              </ul>
            )}
          </section>

          {error ? <Alert>{error}</Alert> : null}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Cancelar
            </Button>
          </DialogClose>
          <Button
            type="button"
            loading={pending}
            disabled={!reason || description.trim().length < 10 || !receivables || !payables || !potential || !preview}
            onClick={confirm}
            aria-label={`Confirmar o encerramento de ${target}`}
          >
            <Ban aria-hidden />
            Confirmar encerramento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
