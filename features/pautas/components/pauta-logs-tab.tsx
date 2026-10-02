"use client";

import { useState, useTransition } from "react";
import { ClipboardCheck, ExternalLink, NotebookPen } from "lucide-react";
import { toast } from "sonner";
import { addPautaLogAction } from "@/features/pautas/actions";
import type { PautaLogEntry, PautaLogKind } from "@/features/pautas/types";
import { UserAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/format";
import { pautaStatusLabel } from "@/lib/pautas";
import type { Squad } from "@/types";

const KIND_LABELS: Record<PautaLogKind, string> = {
  registro: "Registro",
  entrega: "Enviado para revisão",
  ajuste: "Ajuste pedido",
  aprovacao: "Aprovação",
};

interface PautaLogsTabProps {
  pautaId: string;
  squad: Squad | null;
  logs: PautaLogEntry[];
  /** Quem está na pauta registra o que fez. */
  canWrite: boolean;
  onAdded: () => void;
}

/**
 * Registros de execução: o que cada pessoa fez, o que foi entregue para revisão, os ajustes pedidos
 * e a aprovação — o histórico de trabalho da pauta, em ordem do mais recente.
 */
export function PautaLogsTab({ pautaId, squad, logs, canWrite, onAdded }: PautaLogsTabProps) {
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [pending, startTransition] = useTransition();
  const linkInvalid = link.trim() !== "" && !/^https?:\/\//i.test(link.trim());

  function submit() {
    if (body.trim().length < 3 || linkInvalid) return;
    startTransition(async () => {
      const result = await addPautaLogAction({ pautaId, body: body.trim(), linkUrl: link.trim() });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Registro salvo. Líder e quem criou foram avisados.");
      setBody("");
      setLink("");
      onAdded();
    });
  }

  return (
    <div className="space-y-6">
      {canWrite ? (
        <div className="space-y-3 rounded-lg border border-border bg-surface-raised p-4">
          <FormField id="log-body" label="O que você fez?" hint="Ex.: ajustei o estágio do lead no CRM e anexei a proposta. Fica registrado na pauta.">
            <Textarea id="log-body" rows={4} value={body} onChange={(event) => setBody(event.target.value)} />
          </FormField>
          <FormField id="log-link" label="Link" hint="Opcional: documento, print, planilha." error={linkInvalid ? "Use um link começando com http:// ou https://" : undefined}>
            <Input id="log-link" value={link} onChange={(event) => setLink(event.target.value)} placeholder="https://…" />
          </FormField>
          <div className="flex justify-end">
            <Button type="button" onClick={submit} loading={pending} disabled={body.trim().length < 3 || linkInvalid}>
              <NotebookPen aria-hidden />
              Registrar
            </Button>
          </div>
        </div>
      ) : null}

      {logs.length === 0 ? (
        <div className="flex flex-col items-center rounded-lg border border-dashed border-border-strong px-6 py-12 text-center">
          <ClipboardCheck className="mb-3 size-6 text-muted-foreground" aria-hidden />
          <p className="font-bold">Nenhum registro ainda.</p>
          <p className="mt-1 text-sm text-muted-foreground">O que for feito, entregue para revisão ou pedido de ajuste aparece aqui.</p>
        </div>
      ) : (
        <ol className="space-y-4">
          {logs.map((log) => (
            <li key={log.id} className="flex gap-3">
              <UserAvatar name={log.author?.full_name ?? "—"} src={log.author?.avatar_url ?? null} profileId={log.author_id} className="mt-0.5 size-8 shrink-0" />
              <div className="min-w-0 flex-1 rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-sm font-bold">{log.author?.full_name ?? "Alguém"}</span>
                  <Badge variant={log.kind === "ajuste" ? "outline" : "muted"}>{KIND_LABELS[log.kind]}</Badge>
                  {log.status && log.kind === "registro" ? <span className="text-[12px] text-subtle">→ {pautaStatusLabel(log.status, squad)}</span> : null}
                  <span className="ml-auto text-[12px] text-subtle">{formatDateTime(log.created_at)}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{log.body}</p>
                {log.link_url ? (
                  <a
                    href={log.link_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold underline underline-offset-4 hover:text-muted-foreground"
                  >
                    Abrir link
                    <ExternalLink className="size-3.5" aria-hidden />
                  </a>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
