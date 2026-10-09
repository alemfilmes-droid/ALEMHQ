"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { CheckCircle2, CircleDot, CornerDownRight, MessagesSquare, RotateCcw, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createDealNoteAction, deleteDealNoteAction, getDealNotesAction, setDealNoteResolvedAction } from "@/features/crm/notes-actions";
import type { DealNoteDetail, DealNotesThreadData } from "@/features/crm/types";
import { UserAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusDot } from "@/components/ui/status-dot";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, formatDateTime } from "@/lib/format";
import { formatRelativeTime } from "@/lib/relative-time";

interface DealNotesThreadProps {
  dealId: string;
  /** Avisado depois de cada mudança — para atualizar contadores de pedidos abertos fora daqui. */
  onChanged?: (openRequests: number) => void;
}

function countOpen(notes: DealNoteDetail[]) {
  return notes.filter((note) => note.is_request && !note.resolved_at).length;
}

/**
 * "Direcionamentos": conversa interna do negócio — não é o histórico do lead (deal_interactions).
 * O mesmo componente aparece no card do CRM e na pauta espelho do negócio.
 */
export function DealNotesThread({ dealId, onChanged }: DealNotesThreadProps) {
  const [data, setData] = useState<DealNotesThreadData | null>(null);
  const [loading, setLoading] = useState(true);
  // Em ref: o pai pode passar uma função nova a cada render sem recarregar a conversa em loop.
  const onChangedRef = useRef(onChanged);
  onChangedRef.current = onChanged;

  const load = useCallback(() => {
    getDealNotesAction(dealId).then((result) => {
      setData(result);
      setLoading(false);
      if (result) onChangedRef.current?.(countOpen(result.notes));
    });
  }, [dealId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-3" role="status" aria-label="Carregando direcionamentos">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }
  if (!data) return <p className="text-sm text-muted-foreground">Você não tem acesso aos direcionamentos deste negócio.</p>;

  const roots = data.notes.filter((note) => !note.reply_to_id);
  const replies = (id: string) => data.notes.filter((note) => note.reply_to_id === id);
  const open = countOpen(data.notes);

  return (
    <div className="space-y-5">
      <Composer dealId={dealId} data={data} onDone={load} />

      {roots.length === 0 ? (
        <div className="flex flex-col items-center rounded-lg border border-dashed border-border-strong px-6 py-10 text-center">
          <MessagesSquare className="mb-3 size-6 text-muted-foreground" aria-hidden />
          <p className="font-bold">Nenhum direcionamento ainda.</p>
          <p className="mt-1 text-sm text-muted-foreground">Pedidos e notas internas sobre este negócio ficam aqui — o histórico do lead fica em Contatos.</p>
        </div>
      ) : (
        <>
          {open > 0 ? (
            <p className="text-[13px] font-semibold text-muted-foreground">
              {open} {open === 1 ? "pedido aberto" : "pedidos abertos"}
            </p>
          ) : null}
          <ul className="space-y-4">
            {[...roots].reverse().map((note) => (
              <li key={note.id} className="space-y-2">
                <NoteCard note={note} data={data} onDone={load} />
                {replies(note.id).length > 0 ? (
                  <ul className="ml-6 space-y-2 border-l border-border pl-4">
                    {replies(note.id).map((reply) => (
                      <li key={reply.id}>
                        <NoteCard note={reply} data={data} onDone={load} compact />
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function Composer({ dealId, data, onDone }: { dealId: string; data: DealNotesThreadData; onDone: () => void }) {
  const [body, setBody] = useState("");
  const [isRequest, setIsRequest] = useState(false);
  const [assignedTo, setAssignedTo] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const result = await createDealNoteAction({ dealId, body, isRequest, assignedTo: isRequest ? assignedTo : "", dueDate: isRequest ? dueDate : "", replyTo: "" });
      if (result.ok) {
        toast.success(result.message);
        setBody("");
        setIsRequest(false);
        setAssignedTo("");
        setDueDate("");
        onDone();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-3 rounded-md border border-border bg-surface-raised p-3">
      <Textarea
        value={body}
        rows={3}
        aria-label={isRequest ? "Pedido" : "Nota"}
        placeholder={data.canRequest ? "Deixe uma nota ou faça um pedido para alguém do comercial…" : "Deixe uma nota sobre este negócio…"}
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && body.trim()) {
            event.preventDefault();
            submit();
          }
        }}
      />
      <div className="flex flex-wrap items-end justify-between gap-3">
        {data.canRequest ? (
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex items-center gap-2 pb-2">
              <Checkbox id={`request-${dealId}`} checked={isRequest} onCheckedChange={(value) => setIsRequest(value === true)} />
              <Label htmlFor={`request-${dealId}`} className="text-sm">
                É um pedido
              </Label>
            </div>
            {isRequest ? (
              <>
                <div className="space-y-1">
                  <Label htmlFor={`request-to-${dealId}`} className="text-[12px] text-muted-foreground">
                    Para
                  </Label>
                  <NativeSelect id={`request-to-${dealId}`} className="w-52" value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)}>
                    <option value="" disabled>
                      Escolha a pessoa
                    </option>
                    {data.members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.full_name}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`request-due-${dealId}`} className="text-[12px] text-muted-foreground">
                    Até (opcional)
                  </Label>
                  <Input id={`request-due-${dealId}`} type="date" className="w-40" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
                </div>
              </>
            ) : null}
          </div>
        ) : (
          <span />
        )}
        <Button type="button" size="sm" loading={pending} disabled={!body.trim() || (isRequest && !assignedTo)} onClick={submit}>
          <Send aria-hidden />
          {isRequest ? "Enviar pedido" : "Registrar nota"}
        </Button>
      </div>
    </div>
  );
}

function NoteCard({ note, data, onDone, compact = false }: { note: DealNoteDetail; data: DealNotesThreadData; onDone: () => void; compact?: boolean }) {
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState("");
  const [pending, startTransition] = useTransition();
  const me = data.currentUserId;
  const canResolve = note.is_request && (note.assignee?.id === me || note.author?.id === me || data.canManageAll);
  const canDelete = note.author?.id === me;
  const overdue = note.is_request && !note.resolved_at && note.due_at !== null && new Date(note.due_at) < new Date();

  function run(action: () => Promise<{ ok: true; message?: string } | { ok: false; error: string }>, after?: () => void) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toast.success(result.message);
        after?.();
        onDone();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex gap-3">
      <UserAvatar name={note.author?.full_name ?? "—"} src={note.author?.avatar_url ?? null} profileId={note.author?.id} className={compact ? "size-6 shrink-0" : "size-8 shrink-0"} />
      <div className="min-w-0 flex-1 space-y-2 rounded-md border border-border bg-surface-raised p-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-sm font-bold">{note.author?.full_name ?? "—"}</p>
          <p className="text-[12px] text-subtle" title={formatDateTime(note.created_at)}>
            {formatRelativeTime(note.created_at)}
          </p>
          {note.is_request ? (
            <Badge variant="outline">
              <StatusDot tone={note.resolved_at ? "success" : overdue ? "danger" : "warning"} />
              {note.resolved_at ? "Resolvido" : overdue ? "Pedido atrasado" : "Pedido aberto"}
            </Badge>
          ) : null}
        </div>
        {note.is_request ? (
          <p className="text-[12px] font-semibold text-muted-foreground">
            Para {note.assignee?.full_name ?? "—"}
            {note.due_at ? ` · até ${formatDate(note.due_at)}` : ""}
            {note.resolved_at ? ` · resolvido ${formatDateTime(note.resolved_at)}${note.resolver ? ` por ${note.resolver.full_name}` : ""}` : ""}
          </p>
        ) : null}
        <p className="whitespace-pre-wrap text-sm text-muted-foreground">{note.body}</p>

        <div className="flex flex-wrap gap-1">
          {!compact ? (
            <Button type="button" size="sm" variant="ghost" onClick={() => setReplying((value) => !value)}>
              <CornerDownRight aria-hidden />
              Responder
            </Button>
          ) : null}
          {canResolve ? (
            note.resolved_at ? (
              <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => run(() => setDealNoteResolvedAction(note.id, false))}>
                <RotateCcw aria-hidden />
                Reabrir
              </Button>
            ) : (
              <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => run(() => setDealNoteResolvedAction(note.id, true))}>
                <CheckCircle2 aria-hidden />
                Marcar como resolvido
              </Button>
            )
          ) : note.is_request && !note.resolved_at ? (
            <span className="flex items-center gap-1 px-2 text-[12px] text-subtle">
              <CircleDot className="size-3" aria-hidden />
              Aguardando {note.assignee?.full_name ?? "o responsável"}
            </span>
          ) : null}
          {canDelete ? (
            <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => run(() => deleteDealNoteAction(note.id))}>
              <Trash2 aria-hidden />
              Apagar
            </Button>
          ) : null}
        </div>

        {replying ? (
          <div className="space-y-2">
            <Textarea value={reply} rows={2} aria-label="Resposta" placeholder="Responda aqui…" onChange={(event) => setReply(event.target.value)} />
            <div className="flex justify-end">
              <Button
                type="button"
                size="sm"
                loading={pending}
                disabled={!reply.trim()}
                onClick={() =>
                  run(
                    () => createDealNoteAction({ dealId: note.deal_id, body: reply, isRequest: false, assignedTo: "", dueDate: "", replyTo: note.id }),
                    () => {
                      setReply("");
                      setReplying(false);
                    },
                  )
                }
              >
                <Send aria-hidden />
                Responder
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
