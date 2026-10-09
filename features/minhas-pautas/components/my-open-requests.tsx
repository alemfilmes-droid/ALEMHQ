"use client";

import Link from "next/link";
import { MessageSquareWarning } from "lucide-react";
import type { MyOpenRequest } from "@/features/crm/types";
import { crmDealHref } from "@/features/pautas/crm-lock";
import { StatusDot } from "@/components/ui/status-dot";
import { formatDate } from "@/lib/format";
import { formatRelativeTime } from "@/lib/relative-time";
import { SURFACE } from "@/lib/theme";
import { cn } from "@/lib/utils";

/** Pedidos de direcionamento abertos para mim — cada um preso à pauta do negócio, até eu resolver. */
export function MyOpenRequests({ requests, onOpen }: { requests: MyOpenRequest[]; onOpen: (pautaId: string) => void }) {
  if (requests.length === 0) return null;
  const now = new Date();

  return (
    <section aria-labelledby="my-requests-title" className="space-y-3">
      <h2 id="my-requests-title" className="section-title flex items-center gap-2">
        <MessageSquareWarning className="size-4" aria-hidden />
        Direcionamentos pendentes ({requests.length})
      </h2>
      <ul className="grid gap-2 md:grid-cols-2">
        {requests.map((request) => {
          const overdue = request.dueAt !== null && new Date(request.dueAt) < now;
          const content = (
            <>
              <span className="flex items-center gap-2 text-[12px] font-semibold text-subtle">
                <StatusDot tone={overdue ? "danger" : "warning"} />
                <span className="truncate">{request.title}</span>
              </span>
              <span className="line-clamp-2 block text-sm font-semibold">{request.body}</span>
              <span className="block text-[12px] text-muted-foreground">
                {request.authorName ? `${request.authorName} · ` : ""}
                {formatRelativeTime(request.createdAt)}
                {request.dueAt ? ` · ${overdue ? "atrasado desde" : "até"} ${formatDate(request.dueAt)}` : ""}
              </span>
            </>
          );
          const className = cn(SURFACE.card, "block w-full space-y-1 rounded-md p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring");
          return (
            <li key={request.id}>
              {request.pautaId ? (
                <button type="button" className={className} onClick={() => onOpen(request.pautaId!)}>
                  {content}
                </button>
              ) : (
                <Link href={crmDealHref(request.dealId)} className={className}>
                  {content}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
