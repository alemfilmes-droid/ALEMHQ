"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, PencilLine, RefreshCcw, Send, XCircle } from "lucide-react";
import { toast } from "sonner";
import { decideBudgetAction, getClientLinksAction, redoBudgetAction, sendBudgetAction } from "@/features/budgets/actions";
import { brl } from "@/features/budgets/pricing";
import { BUDGET_STATUS_LABELS, type BudgetRecord } from "@/features/budgets/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/format";

const NO_DEAL = "__sem_crm__";
const CHANNELS = [
  { value: "whatsapp_pdf", label: "WhatsApp (PDF)" },
  { value: "email", label: "E-mail" },
  { value: "meet", label: "Reunião online" },
  { value: "presencial", label: "Presencial" },
  { value: "ligacao", label: "Ligação" },
] as const;

type Decision = "aprovado" | "em_ajuste" | "recusado";

const DECISION_COPY: Record<Decision, { title: string; label: string; hint: string }> = {
  aprovado: { title: "Orçamento aprovado.", label: "Observação (opcional)", hint: "O CRM marca a proposta como aceita. O negócio é fechado como ganho no card do cliente." },
  em_ajuste: { title: "Cliente pediu ajuste.", label: "O que precisa mudar", hint: "Depois use “Refazer” para criar a nova versão com os ajustes." },
  recusado: { title: "Orçamento recusado.", label: "Motivo (opcional)", hint: "O CRM marca a proposta como recusada." },
};

/**
 * Situação do orçamento e o que fazer agora: enviar ao cliente (registrando a proposta no negócio
 * do CRM, o que leva o valor para "em negociação" no financeiro), registrar a resposta do cliente
 * (aprovado, ajuste, recusado) e refazer como nova versão.
 */
export function BudgetStatusPanel({
  budget,
  total,
  companyId,
  beforeSend,
}: {
  budget: BudgetRecord;
  total: number;
  companyId: string | null;
  beforeSend: () => Promise<boolean>;
}) {
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [deals, setDeals] = useState<{ id: string; title: string; stage: string }[]>([]);
  const [dealId, setDealId] = useState(budget.dealId ?? NO_DEAL);
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]["value"]>("whatsapp_pdf");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!sending || !companyId) return;
    void getClientLinksAction(companyId).then((links) => {
      setDeals(links.deals);
      if (!budget.dealId && links.deals[0]) setDealId(links.deals[0].id);
    });
  }, [sending, companyId, budget.dealId]);

  function send() {
    startTransition(async () => {
      if (!(await beforeSend())) return;
      const result = await sendBudgetAction(budget.id, { dealId: dealId === NO_DEAL ? "" : dealId, channel });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      setSending(false);
      router.refresh();
    });
  }

  function decide() {
    if (!decision) return;
    startTransition(async () => {
      const result = await decideBudgetAction(budget.id, { status: decision, note });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      setDecision(null);
      setNote("");
      router.refresh();
    });
  }

  function redo() {
    startTransition(async () => {
      const result = await redoBudgetAction(budget.id);
      if (!result.ok) toast.error(result.error);
      else if (result.id) {
        toast.success(result.message);
        router.push(`/orcamentos/${result.id}`);
      }
    });
  }

  const status = budget.status;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface-raised p-4">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="flex flex-wrap items-center gap-2">
          <Badge variant={status === "aprovado" ? "solid" : "outline"}>{BUDGET_STATUS_LABELS[status]}</Badge>
          {budget.version > 1 ? <Badge variant="muted">Versão {budget.version}</Badge> : null}
          {budget.dealId ? (
            <Link href={`/crm?aba=leads&negocio=${budget.dealId}`} className="text-[13px] underline underline-offset-4 hover:text-foreground">
              No CRM: {budget.dealTitle ?? "negócio"}
            </Link>
          ) : null}
        </p>
        <p className="text-[12px] text-subtle">
          {budget.sentAt ? `Enviado em ${formatDateTime(budget.sentAt)}` : "Ainda não enviado."}
          {budget.decidedAt ? ` · resposta em ${formatDateTime(budget.decidedAt)}` : ""}
          {budget.statusNote ? ` · “${budget.statusNote}”` : ""}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {status === "rascunho" || status === "em_ajuste" ? (
          <Button type="button" onClick={() => setSending(true)} disabled={pending}>
            <Send aria-hidden />
            {status === "em_ajuste" ? "Reenviar" : "Enviar ao cliente"}
          </Button>
        ) : null}
        {status === "enviado" ? (
          <>
            <Button type="button" onClick={() => setDecision("aprovado")} disabled={pending}>
              <CheckCircle2 aria-hidden />
              Aprovado
            </Button>
            <Button type="button" variant="secondary" onClick={() => setDecision("em_ajuste")} disabled={pending}>
              <PencilLine aria-hidden />
              Pedir ajuste
            </Button>
            <Button type="button" variant="secondary" onClick={() => setDecision("recusado")} disabled={pending}>
              <XCircle aria-hidden />
              Recusado
            </Button>
          </>
        ) : null}
        {status !== "rascunho" ? (
          <Button type="button" variant="secondary" onClick={redo} loading={pending}>
            <RefreshCcw aria-hidden />
            Refazer (nova versão)
          </Button>
        ) : null}
      </div>

      {sending ? (
        <Dialog open onOpenChange={(next) => !next && setSending(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Enviar ao cliente.</DialogTitle>
              <DialogDescription>
                {budget.clientName} · {brl(total)}. Registrar no negócio do CRM coloca a proposta no card do cliente e o valor em negociação no
                financeiro.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <FormField id="send-deal" label="Negócio no CRM" hint={companyId ? undefined : "Vincule o orçamento a um cliente cadastrado para registrar no CRM."}>
                <Select value={dealId} onValueChange={setDealId}>
                  <SelectTrigger id="send-deal">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_DEAL}>Não registrar no CRM</SelectItem>
                    {deals.map((deal) => (
                      <SelectItem key={deal.id} value={deal.id}>
                        {deal.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField id="send-channel" label="Enviado por">
                <Select value={channel} onValueChange={(value) => setChannel(value as typeof channel)}>
                  <SelectTrigger id="send-channel">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHANNELS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setSending(false)}>
                Cancelar
              </Button>
              <Button type="button" onClick={send} loading={pending}>
                <Send aria-hidden />
                Marcar como enviado
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      {decision ? (
        <Dialog open onOpenChange={(next) => !next && setDecision(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{DECISION_COPY[decision].title}</DialogTitle>
              <DialogDescription>{DECISION_COPY[decision].hint}</DialogDescription>
            </DialogHeader>
            <FormField id="decision-note" label={DECISION_COPY[decision].label}>
              <Textarea id="decision-note" rows={3} value={note} onChange={(event) => setNote(event.target.value)} />
            </FormField>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setDecision(null)}>
                Cancelar
              </Button>
              <Button type="button" onClick={decide} loading={pending} disabled={decision === "em_ajuste" && note.trim().length < 3}>
                Confirmar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
