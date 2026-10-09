"use client";

import { AlertTriangle, ArrowRight, CircleCheck, Clock } from "lucide-react";
import { CADENCE_MAX_ATTEMPTS, cadenceStatus, interactionReplyLabel, interactionReplyTone } from "@/features/crm/cadence";
import { ChannelIcon } from "@/features/crm/components/channel-icon";
import { DEAL_STAGE_LABELS, INTERACTION_CHANNEL_LABELS, INTERACTION_KIND_LABELS } from "@/features/crm/labels";
import type { DealInteractionDetail } from "@/features/crm/types";
import { UserAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { StatusDot } from "@/components/ui/status-dot";
import { formatDateTime } from "@/lib/format";
import { toneColor } from "@/lib/status";
import type { DealInteractionChannel, DealStage } from "@/types";

/** Agrupa da mais nova para a mais antiga, abrindo um grupo novo a cada mudança de etapa. */
function groupByStage(interactions: DealInteractionDetail[]) {
  const groups: { stage: DealStage; items: DealInteractionDetail[] }[] = [];
  for (const item of interactions) {
    const last = groups[groups.length - 1];
    if (last && last.stage === item.stage) last.items.push(item);
    else groups.push({ stage: item.stage, items: [item] });
  }
  return groups;
}

function attemptsByChannel(interactions: DealInteractionDetail[]) {
  const counts = new Map<DealInteractionChannel, number>();
  for (const item of interactions) {
    if (item.kind !== "tentativa_contato" || !item.channel) continue;
    counts.set(item.channel, (counts.get(item.channel) ?? 0) + 1);
  }
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
}

/** Cadência: tentativa N de 7; a partir da 3ª, uma a cada 2 dias. */
function CadenceIndicator({ interactions }: { interactions: DealInteractionDetail[] }) {
  const cadence = cadenceStatus(interactions);
  if (cadence.streak === 0) return null;
  const tone = cadence.limitReached || cadence.overdue ? "danger" : cadence.streak >= CADENCE_MAX_ATTEMPTS - 2 ? "warning" : "neutral";
  return (
    <Badge variant="outline" title="Regra da empresa: até 7 tentativas; a partir da terceira, intervalo de 2 dias.">
      <StatusDot tone={tone} />
      {cadence.limitReached
        ? `Limite de ${CADENCE_MAX_ATTEMPTS} tentativas atingido`
        : `Tentativa ${cadence.streak} de ${CADENCE_MAX_ATTEMPTS} sem resposta`}
      {!cadence.limitReached && cadence.nextDueAt ? (
        <span className="flex items-center gap-1 font-normal">
          · {cadence.overdue ? <AlertTriangle className="size-3" aria-hidden /> : <Clock className="size-3" aria-hidden />}
          {cadence.overdue ? "próxima atrasada desde " : "próxima até "}
          {formatDateTime(cadence.nextDueAt)}
        </span>
      ) : null}
    </Badge>
  );
}

function Detail({ item, byId }: { item: DealInteractionDetail; byId: Map<string, DealInteractionDetail> }) {
  const linked = item.responded_to_interaction_id ? byId.get(item.responded_to_interaction_id) : null;
  const summary = item.summary ?? item.body;
  const fullApproach = item.summary && item.body && item.body !== item.summary ? item.body : null;
  const reply = interactionReplyLabel(item);

  return (
    <div className="space-y-3 text-sm">
      <div className="space-y-1">
        <p className="eyebrow">{INTERACTION_KIND_LABELS[item.kind]}</p>
        <p className="font-semibold">{summary}</p>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[13px]">
        <dt className="text-subtle">Quando</dt>
        <dd>{formatDateTime(item.occurred_at)}</dd>
        <dt className="text-subtle">Canal</dt>
        <dd className="flex items-center gap-1.5">
          <ChannelIcon channel={item.channel} />
          {item.channel ? INTERACTION_CHANNEL_LABELS[item.channel] : "—"}
        </dd>
        {item.approach ? (
          <>
            <dt className="text-subtle">Abordagem</dt>
            <dd>{item.approach}</dd>
          </>
        ) : null}
        {reply ? (
          <>
            <dt className="text-subtle">Resposta</dt>
            <dd className="flex items-center gap-1.5">
              <StatusDot tone={interactionReplyTone(item)} />
              {reply}
            </dd>
          </>
        ) : null}
        {linked ? (
          <>
            <dt className="text-subtle">{item.kind === "resposta_cliente" ? "Respondeu à" : "Sobre a"}</dt>
            <dd>
              tentativa de {formatDateTime(linked.occurred_at)}
              {linked.channel ? ` (${INTERACTION_CHANNEL_LABELS[linked.channel]})` : ""}
              {item.kind === "tentativa_contato" ? (linked.responded === true ? " — o cliente respondeu" : linked.responded === false ? " — sem resposta" : "") : ""}
            </dd>
          </>
        ) : null}
        {item.next_step ? (
          <>
            <dt className="text-subtle">Próximo passo</dt>
            <dd>{item.next_step}</dd>
          </>
        ) : null}
        <dt className="text-subtle">Registrado por</dt>
        <dd className="flex items-center gap-1.5">
          <UserAvatar name={item.author?.full_name ?? "—"} src={item.author?.avatar_url ?? null} profileId={item.author?.id} className="size-4" />
          {item.author?.full_name ?? "Sistema"}
        </dd>
      </dl>
      {fullApproach ? (
        <div className="space-y-1">
          <p className="text-[12px] font-semibold text-subtle">Abordagem completa</p>
          <p className="whitespace-pre-wrap text-[13px] text-muted-foreground">{fullApproach}</p>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Histórico do lead: uma linha por interação (ícone, canal, abordagem, data, indicador de resposta),
 * com barra e ponto — verde quando teve resposta, vermelho quando não teve, neutro enquanto aguarda.
 * Clique abre o detalhe completo.
 */
export function InteractionsTimeline({ interactions, showCadence = true }: { interactions: DealInteractionDetail[]; showCadence?: boolean }) {
  if (interactions.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum contato registrado ainda.</p>;
  }

  const attempts = attemptsByChannel(interactions);
  const byId = new Map(interactions.map((item) => [item.id, item]));

  return (
    <div className="space-y-4">
      {attempts.length > 0 || showCadence ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {attempts.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5" aria-label="Tentativas por canal">
              {attempts.map(([channel, count]) => (
                <li key={channel}>
                  <Badge variant="muted">
                    <ChannelIcon channel={channel} />
                    {INTERACTION_CHANNEL_LABELS[channel]} × {count}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : null}
          {showCadence ? <CadenceIndicator interactions={interactions} /> : null}
        </div>
      ) : null}

      {groupByStage(interactions).map((group, index) => (
        <section key={`${group.stage}-${index}`} aria-label={`Etapa ${DEAL_STAGE_LABELS[group.stage]}`} className="space-y-1.5">
          <p className="eyebrow">{DEAL_STAGE_LABELS[group.stage]}</p>
          <ul className="space-y-1">
            {group.items.map((item) => {
              const tone = interactionReplyTone(item);
              const color = toneColor(tone) ?? "var(--border-strong)";
              const reply = interactionReplyLabel(item);
              return (
                <li key={item.id}>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="relative flex w-full items-center gap-2 overflow-hidden rounded-md border border-border py-2 pl-4 pr-3 text-left text-[13px] transition-colors hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                        aria-label={`${INTERACTION_KIND_LABELS[item.kind]} de ${formatDateTime(item.occurred_at)}${reply ? ` — ${reply}` : ""}`}
                      >
                        <span aria-hidden className="absolute inset-y-0 left-0 w-[3px]" style={{ background: color }} />
                        <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: color }} />
                        <ChannelIcon channel={item.channel} />
                        <span className="shrink-0 font-semibold">{item.channel ? INTERACTION_CHANNEL_LABELS[item.channel] : INTERACTION_KIND_LABELS[item.kind]}</span>
                        <span className="min-w-0 flex-1 truncate text-muted-foreground">{item.approach ?? item.summary ?? item.body}</span>
                        {item.stage_to && item.stage_to !== item.stage ? (
                          <span className="hidden shrink-0 items-center gap-1 text-subtle sm:flex">
                            <ArrowRight className="size-3" aria-hidden />
                            {DEAL_STAGE_LABELS[item.stage_to]}
                          </span>
                        ) : null}
                        <span className="shrink-0 tabular-nums text-subtle">{formatDateTime(item.occurred_at)}</span>
                        {reply ? (
                          <span className="hidden shrink-0 items-center gap-1 font-semibold sm:flex">
                            {tone === "success" ? <CircleCheck className="size-3.5" aria-hidden /> : null}
                            {reply}
                          </span>
                        ) : null}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-[min(26rem,calc(100vw-2rem))]">
                      <Detail item={item} byId={byId} />
                    </PopoverContent>
                  </Popover>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
