import Link from "next/link";
import { StatusDot } from "@/components/ui/status-dot";
import type { TimelineEvent } from "@/features/clients/types";
import { DEAL_LOSS_REASON_LABELS } from "@/features/crm/labels";
import { formatDate } from "@/lib/format";
import { CLIENT_HEALTH_LABELS, CLIENT_HEALTH_TONE, type StatusTone } from "@/lib/status";
import type { ClientHealth, DealLossReason } from "@/types";

const HEALTHS = Object.keys(CLIENT_HEALTH_LABELS) as ClientHealth[];
const LOSS_REASONS = Object.keys(DEAL_LOSS_REASON_LABELS) as DealLossReason[];

function asHealth(value: unknown): ClientHealth | null {
  return HEALTHS.find((item) => item === value) ?? null;
}

function describe(event: TimelineEvent): { text: string; tone: StatusTone; href?: string; detail?: string } {
  const label = event.label ?? "";
  switch (event.kind) {
    case "cadastro":
      return { text: "Empresa cadastrada", tone: "neutral" };
    case "virou_cliente":
      return { text: "Virou cliente", tone: "success" };
    case "projeto_criado":
      return { text: `Projeto criado — ${label}`, tone: "neutral", href: event.refId ? `/projetos/${event.refId}` : undefined };
    case "projeto_entregue":
      return { text: `Projeto entregue — ${label}`, tone: "success", href: event.refId ? `/projetos/${event.refId}` : undefined };
    case "negocio_ganho":
      return { text: `Negócio ganho — ${label}`, tone: "success", href: event.refId ? `/crm?aba=leads&negocio=${event.refId}` : undefined };
    case "negocio_perdido": {
      const reason = LOSS_REASONS.find((item) => item === event.meta.reason);
      return {
        text: `Negócio perdido — ${label}`,
        tone: "danger",
        href: event.refId ? `/crm?aba=leads&negocio=${event.refId}` : undefined,
        detail: reason ? DEAL_LOSS_REASON_LABELS[reason] : undefined,
      };
    }
    case "saude": {
      const from = asHealth(event.meta.from);
      const to = asHealth(event.meta.to);
      const note = typeof event.meta.note === "string" && event.meta.note.trim() ? event.meta.note : undefined;
      return {
        text: `Saúde: ${from ? CLIENT_HEALTH_LABELS[from] : "—"} → ${to ? CLIENT_HEALTH_LABELS[to] : "—"}`,
        tone: to ? CLIENT_HEALTH_TONE[to] : "neutral",
        detail: note,
      };
    }
  }
}

interface RelationshipTimelineProps {
  events: TimelineEvent[];
  hasMore: boolean;
  moreHref: string;
}

/** Eventos-chave do relacionamento, do mais novo para o mais antigo. Cor só no ponto de 8px. */
export function RelationshipTimeline({ events, hasMore, moreHref }: RelationshipTimelineProps) {
  return (
    <section aria-labelledby="timeline-title" className="mt-10 space-y-4">
      <h2 id="timeline-title" className="section-title">
        Linha do tempo do relacionamento
      </h2>
      {events.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border-strong p-6 text-sm text-muted-foreground">Nenhum evento registrado ainda.</p>
      ) : (
        <ol className="relative space-y-4 border-l border-border pl-5">
          {events.map((event, index) => {
            const item = describe(event);
            return (
              <li key={`${event.kind}-${event.refId ?? ""}-${event.at}-${index}`} className="relative">
                <span className="absolute -left-[25px] top-1.5 flex size-2.5 items-center justify-center rounded-full bg-background">
                  <StatusDot tone={item.tone} />
                </span>
                <p className="text-sm font-semibold">
                  {item.href ? (
                    <Link href={item.href} className="hover:underline">
                      {item.text}
                    </Link>
                  ) : (
                    item.text
                  )}
                </p>
                <p className="text-[12px] text-subtle">
                  {formatDate(event.at)}
                  {item.detail ? ` · ${item.detail}` : ""}
                </p>
              </li>
            );
          })}
        </ol>
      )}
      {hasMore ? (
        <Link href={moreHref} scroll={false} className="inline-block text-sm font-semibold underline underline-offset-4 hover:text-muted-foreground">
          Ver mais
        </Link>
      ) : null}
    </section>
  );
}
