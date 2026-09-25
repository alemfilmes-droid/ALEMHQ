"use client";

import { useState, useTransition } from "react";
import { MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";
import { addPautaCommentAction } from "@/features/pautas/actions";
import type { PautaCommentDetail } from "@/features/pautas/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/ui/avatar";
import { formatRelativeTime } from "@/lib/relative-time";

interface PautaCommentsTabProps {
  pautaId: string;
  comments: PautaCommentDetail[];
  onAdded: (comment: PautaCommentDetail) => void;
  currentUser: { id: string; full_name: string; avatar_url: string | null };
}

export function PautaCommentsTab({ pautaId, comments, onAdded, currentUser }: PautaCommentsTabProps) {
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    const trimmed = body.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const result = await addPautaCommentAction({ pautaId, body: trimmed });
      if (result.ok) {
        onAdded({
          id: crypto.randomUUID(),
          body: trimmed,
          created_at: new Date().toISOString(),
          edited_at: null,
          author_id: currentUser.id,
          author: currentUser,
        });
        setBody("");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex gap-3">
        <Textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Escreva um comentário…"
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              submit();
            }
          }}
        />
      </div>
      <div className="flex justify-end">
        <Button type="button" size="sm" loading={pending} disabled={!body.trim()} onClick={submit}>
          <Send aria-hidden />
          Comentar
        </Button>
      </div>

      {comments.length === 0 ? (
        <div className="flex flex-col items-center rounded-lg border border-dashed border-border-strong px-6 py-12 text-center">
          <MessageSquare className="mb-3 size-6 text-muted-foreground" aria-hidden />
          <p className="font-bold">Nenhum comentário ainda.</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {[...comments].reverse().map((comment) => (
            <li key={comment.id} className="flex gap-3">
              <UserAvatar name={comment.author?.full_name ?? "—"} src={comment.author?.avatar_url ?? null} className="size-8 shrink-0" />
              <div className="min-w-0 flex-1 rounded-md border border-border bg-surface-raised p-3">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold">{comment.author?.full_name ?? "—"}</p>
                  <p className="text-[12px] text-subtle">{formatRelativeTime(comment.created_at)}</p>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{comment.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
