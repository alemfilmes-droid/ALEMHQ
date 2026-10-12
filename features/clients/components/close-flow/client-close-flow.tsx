"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Ban } from "lucide-react";
import { toast } from "sonner";
import { ActionError } from "@/components/ui/action-error";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { getClosurePreviewAction, type ClosurePreview } from "@/features/clients/closure-actions";
import { CLOSURE_REASON_LABELS, PROSPECT_POTENTIALS, PROSPECT_POTENTIAL_LABELS } from "@/features/clients/closures";
import { EMPTY_ANSWER, FinanceStep, financeStepDone, type FinanceAnswer } from "@/features/clients/components/close-flow/finance-step";
import { clientCloseAction } from "@/features/clients/lifecycle-actions";
import { parseMoneyToCents } from "@/features/finance/money";
import { needsReload, runAction } from "@/lib/actions/client-action";
import { ENDED_REASONS, manualEntryError } from "@/lib/clients/lifecycle";
import { STAGE_LABELS } from "@/lib/domain";
import { todayInFortaleza } from "@/lib/pautas";
import { cn } from "@/lib/utils";
import type { ClosureReason, ProspectPotential } from "@/types";

export interface ClientCloseFlowProps {
  companyId: string;
  companyName: string;
  /** "Encerrado" pré-escolhido (ex.: depois de finalizar o último projeto). */
  initial?: { status: "churn" | "encerrado"; reason?: ClosureReason };
  onClose: () => void;
}

const STEPS = ["Situação", "Projetos e pautas", "A receber", "A pagar", "Revisão"] as const;

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * Encerrar cliente (Churn ou Encerrado) em passos, como pedido: situação → o que vai ser finalizado →
 * a receber → a pagar → revisão. Nada muda até "Confirmar encerramento"; aí o banco faz tudo de uma vez.
 */
export function ClientCloseFlow({ companyId, companyName, initial, onClose }: ClientCloseFlowProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState<"churn" | "encerrado" | "">(initial?.status ?? "");
  const [endedReason, setEndedReason] = useState<ClosureReason | "">(initial?.reason ?? "");
  const [description, setDescription] = useState("");
  const [closedAt, setClosedAt] = useState(todayInFortaleza());
  const [potential, setPotential] = useState<ProspectPotential | "">("");
  const [notes, setNotes] = useState("");
  const [confirmedWork, setConfirmedWork] = useState(false);
  const [receivables, setReceivables] = useState<FinanceAnswer>(EMPTY_ANSWER);
  const [payables, setPayables] = useState<FinanceAnswer>(EMPTY_ANSWER);
  const [preview, setPreview] = useState<ClosurePreview | null | undefined>(undefined);
  const [failure, setFailure] = useState<{ message: string; reload: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(closedAt)) return;
    let active = true;
    setPreview(undefined);
    getClosurePreviewAction(companyId, null, closedAt).then((data) => active && setPreview(data));
    return () => {
      active = false;
    };
  }, [companyId, closedAt]);

  const reason: ClosureReason | "" = status === "churn" ? "churn" : endedReason;
  const manualErrors = [
    ...receivables.manual.map((entry) => manualEntryError(entry, "receivable", parseMoneyToCents)),
    ...payables.manual.map((entry) => manualEntryError(entry, "payable", parseMoneyToCents)),
  ].filter(Boolean);

  const canAdvance = preview
    ? [
        Boolean(reason) && description.trim().length >= 10 && Boolean(potential),
        confirmedWork || (preview.projects.length === 0 && preview.pautas.length === 0),
        financeStepDone(receivables, preview.receivables) && (receivables.answer !== "sim" || manualErrors.length === 0),
        financeStepDone(payables, preview.payables) && (payables.answer !== "sim" || manualErrors.length === 0),
        true,
      ][step]
    : false;

  function confirm() {
    if (!reason || !potential) return;
    setFailure(null);
    startTransition(async () => {
      const result = await runAction(() =>
        clientCloseAction({
          companyId,
          reason,
          description,
          closedAt,
          potential,
          notes,
          keepReceivableIds: receivables.answer === "sim" ? receivables.keptIds : [],
          keepPayableIds: payables.answer === "sim" ? payables.keptIds : [],
          manualReceivables: receivables.answer === "sim" ? receivables.manual : [],
          manualPayables: payables.answer === "sim" ? payables.manual.map((entry) => ({ ...entry, payeeName: entry.payeeName ?? "" })) : [],
        }),
      );
      if (!result.ok) return setFailure({ message: result.error, reload: needsReload(result) });
      toast.success(result.message);
      onClose();
      router.refresh();
    });
  }

  const cancelledCount = (answer: FinanceAnswer, total: number) => (answer.answer === "sim" ? total - answer.keptIds.length : total);

  return (
    <Dialog open onOpenChange={(next) => !next && !pending && onClose()}>
      <DialogContent className="flex max-h-[92dvh] max-w-2xl flex-col p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Encerrar cliente.</DialogTitle>
          <DialogDescription>
            {companyName} · passo {step + 1} de {STEPS.length}: {STEPS[step]}
          </DialogDescription>
        </DialogHeader>
        <ol className="flex gap-1" aria-hidden>
          {STEPS.map((label, index) => (
            <li key={label} className={cn("h-1 flex-1 rounded-full", index <= step ? "bg-foreground" : "bg-border-strong")} />
          ))}
        </ol>

        <div className="-mx-1 min-h-0 flex-1 space-y-5 overflow-y-auto px-1">
          {step === 0 ? (
            <>
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Situação do cliente">
                {(
                  [
                    ["churn", "Churn", "Saiu, não renovou ou foi para a concorrência."],
                    ["encerrado", "Encerrado", "Fim planejado: contrato ou projeto concluído."],
                  ] as const
                ).map(([key, label, hint]) => (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={status === key}
                    onClick={() => setStatus(key)}
                    className={cn(
                      "min-h-11 rounded-md border px-3 py-2 text-left text-sm",
                      status === key ? "border-foreground bg-surface-hover font-bold" : "border-border-strong text-muted-foreground",
                    )}
                  >
                    {label}
                    <span className="block text-[12px] font-normal text-muted-foreground">{hint}</span>
                  </button>
                ))}
              </div>
              {status === "encerrado" ? (
                <FormField id="close-reason" label="Motivo">
                  <NativeSelect id="close-reason" value={endedReason} onChange={(event) => setEndedReason(event.target.value as ClosureReason)}>
                    <option value="" disabled>
                      Escolha o motivo
                    </option>
                    {ENDED_REASONS.map((item) => (
                      <option key={item} value={item}>
                        {CLOSURE_REASON_LABELS[item]}
                      </option>
                    ))}
                  </NativeSelect>
                </FormField>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField id="close-date" label="Data do encerramento">
                  <Input id="close-date" type="date" value={closedAt} onChange={(event) => setClosedAt(event.target.value)} />
                </FormField>
                <FormField id="close-potential" label="Vale abordar de novo?">
                  <NativeSelect id="close-potential" value={potential} onChange={(event) => setPotential(event.target.value as ProspectPotential)}>
                    <option value="" disabled>
                      Potencial futuro
                    </option>
                    {PROSPECT_POTENTIALS.map((item) => (
                      <option key={item} value={item}>
                        {PROSPECT_POTENTIAL_LABELS[item]}
                      </option>
                    ))}
                  </NativeSelect>
                </FormField>
              </div>
              <FormField id="close-description" label="O que aconteceu" hint="Fica visível no cliente e no CRM para quem for abordar de novo.">
                <Textarea id="close-description" rows={3} value={description} onChange={(event) => setDescription(event.target.value)} />
              </FormField>
              <FormField id="close-notes" label="Observações (opcional)">
                <Input id="close-notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
              </FormField>
            </>
          ) : null}

          {step === 1 && preview ? (
            <div className="space-y-3 text-sm">
              <p className="font-semibold">Vai ser finalizado:</p>
              {preview.projects.length === 0 && preview.pautas.length === 0 ? (
                <p className="text-muted-foreground">Nenhum projeto ou pauta ativa.</p>
              ) : (
                <>
                  <ul className="space-y-1">
                    {preview.projects.map((project) => (
                      <li key={project.id}>
                        Projeto <strong>{project.name}</strong> ({STAGE_LABELS[project.stage]}) → Encerrado
                      </li>
                    ))}
                    {preview.pautas.map((pauta) => (
                      <li key={pauta.id}>
                        Pauta <strong>{pauta.title}</strong>
                        {pauta.assignee ? ` · ${pauta.assignee}` : ""} → finalizada (os responsáveis são avisados)
                      </li>
                    ))}
                  </ul>
                  <label className="flex min-h-11 items-center gap-3 font-semibold">
                    <Checkbox className="size-5" checked={confirmedWork} onCheckedChange={(checked) => setConfirmedWork(checked === true)} />
                    Entendi: {plural(preview.projects.length, "projeto", "projetos")} e {plural(preview.pautas.length, "pauta", "pautas")} serão finalizados
                  </label>
                </>
              )}
              <p className="text-[13px] text-muted-foreground">Enquanto o cliente estiver inativo, ninguém cria projeto ou pauta nova para ele.</p>
            </div>
          ) : null}

          {step === 2 && preview ? (
            <FinanceStep kind="receivable" rows={preview.receivables} financeVisible={preview.financeVisible} value={receivables} onChange={setReceivables} />
          ) : null}
          {step === 3 && preview ? (
            <FinanceStep kind="payable" rows={preview.payables} financeVisible={preview.financeVisible} value={payables} onChange={setPayables} />
          ) : null}

          {step === 4 && preview ? (
            <ul className="space-y-1.5 text-sm">
              <li>
                Cliente → <strong>{status === "churn" ? "Churn" : `Encerrado (${reason ? CLOSURE_REASON_LABELS[reason] : ""})`}</strong>, na coluna Inativos
              </li>
              <li>{plural(preview.projects.length, "projeto encerrado", "projetos encerrados")} · {plural(preview.pautas.length, "pauta finalizada", "pautas finalizadas")}</li>
              <li>
                Recebimentos: {plural(cancelledCount(receivables, preview.receivables.length), "cancelado", "cancelados")}
                {receivables.answer === "sim" ? `, ${plural(receivables.keptIds.length, "continua", "continuam")}, ${plural(receivables.manual.length, "novo", "novos")}` : ""}
              </li>
              <li>
                Custos: {plural(cancelledCount(payables, preview.payables.length), "cancelado", "cancelados")}
                {payables.answer === "sim" ? `, ${plural(payables.keptIds.length, "continua", "continuam")}, ${plural(payables.manual.length, "novo", "novos")}` : ""}
              </li>
              <li className="text-muted-foreground">Cancelar é mudar o status (motivo “Encerramento do cliente”, quem e quando). O que já foi pago ou recebido não muda.</li>
              {status === "churn" ? <li className="text-muted-foreground">Churn não vira “cliente da casa”: retornos pendentes são cancelados.</li> : null}
            </ul>
          ) : null}

          {preview === undefined && step > 0 ? <Skeleton className="h-28 w-full" /> : null}
          {preview === null ? <p className="text-sm text-muted-foreground">Não foi possível montar a prévia. Verifique a data e tente de novo.</p> : null}
          <ActionError message={failure?.message ?? null} reload={failure?.reload} />
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-border pt-3 sm:flex-row sm:justify-between">
          <Button type="button" variant="secondary" size="lg" disabled={pending} onClick={() => (step === 0 ? onClose() : setStep(step - 1))}>
            {step === 0 ? "Cancelar" : (
              <>
                <ArrowLeft aria-hidden />
                Voltar
              </>
            )}
          </Button>
          {step < STEPS.length - 1 ? (
            <Button type="button" size="lg" disabled={!canAdvance} onClick={() => setStep(step + 1)}>
              Continuar
              <ArrowRight aria-hidden />
            </Button>
          ) : (
            <Button type="button" size="lg" loading={pending} onClick={confirm}>
              <Ban aria-hidden />
              Confirmar encerramento
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
