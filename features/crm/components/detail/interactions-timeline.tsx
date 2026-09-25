import { ArrowRight } from "lucide-react";
import { ChannelIcon } from "@/features/crm/components/channel-icon";
import { DEAL_STAGE_LABELS, INTERACTION_CHANNEL_LABELS, INTERACTION_KIND_LABELS } from "@/features/crm/labels";
import type { DealInteractionDetail } from "@/features/crm/types";
import { UserAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";
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

export function InteractionsTimeline({ interactions }: { interactions: DealInteractionDetail[] }) {
  if (interactions.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum contato registrado ainda.</p>;
  }

  const attempts = attemptsByChannel(interactions);
  const byId = new Map(interactions.map((item) => [item.id, item]));

  return (
    <div className="space-y-4">
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

      {groupByStage(interactions).map((group, index) => (
        <section key={`${group.stage}-${index}`} aria-label={`Etapa ${DEAL_STAGE_LABELS[group.stage]}`} className="space-y-2">
          <p className="eyebrow">{DEAL_STAGE_LABELS[group.stage]}</p>
          <ul className="space-y-3 border-l border-border pl-4">
            {group.items.map((item) => {
              const answered = item.responded_to_interaction_id ? byId.get(item.responded_to_interaction_id) : null;
              return (
                <li key={item.id} className="space-y-1">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-semibold text-muted-foreground">
                    <ChannelIcon channel={item.channel} />
                    <span>{INTERACTION_KIND_LABELS[item.kind]}</span>
                    {item.channel ? <span>· {INTERACTION_CHANNEL_LABELS[item.channel]}</span> : null}
                    {item.approach ? <span>· {item.approach}</span> : null}
                    <span className="font-normal">· {formatDateTime(item.occurred_at)}</span>
                    {item.stage_to && item.stage_to !== item.stage ? (
                      <span className="flex items-center gap-1 font-normal">
                        <ArrowRight className="size-3" aria-hidden />
                        {DEAL_STAGE_LABELS[item.stage_to]}
                      </span>
                    ) : null}
                  </p>
                  <p className="whitespace-pre-wrap text-sm">{item.body}</p>
                  {answered ? (
                    <p className="text-[12px] text-subtle">
                      Respondeu à tentativa de {formatDateTime(answered.occurred_at)}
                      {answered.channel ? ` (${INTERACTION_CHANNEL_LABELS[answered.channel]})` : ""}.
                    </p>
                  ) : null}
                  <p className="flex items-center gap-1.5 text-[12px] text-subtle">
                    <UserAvatar name={item.author?.full_name ?? "—"} src={item.author?.avatar_url ?? null} className="size-4" />
                    {item.author?.full_name ?? "Sistema"}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
