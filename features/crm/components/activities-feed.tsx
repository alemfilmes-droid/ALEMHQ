import Link from "next/link";
import { Inbox } from "lucide-react";
import { ChannelIcon } from "@/features/crm/components/channel-icon";
import { DEAL_STAGE_LABELS, INTERACTION_CHANNEL_LABELS, INTERACTION_KIND_LABELS } from "@/features/crm/labels";
import { listInteractionsFeed } from "@/features/crm/queries";
import { EmptyState } from "@/features/finance/components/table-shell";
import { UserAvatar } from "@/components/ui/avatar";
import { formatRelativeTime } from "@/lib/relative-time";

interface ActivitiesFeedProps {
  ownerId?: string[];
  kind?: string[];
}

/** Feed cronológico de todos os contatos que a pessoa pode ver — útil para o head acompanhar o dia do time. */
export async function ActivitiesFeed({ ownerId, kind }: ActivitiesFeedProps) {
  const interactions = await listInteractionsFeed({ ownerId, kind });

  if (interactions.length === 0) {
    return <EmptyState icon={Inbox} title="Nenhuma atividade encontrada." hint="Ajuste os filtros ou registre um contato em um negócio." />;
  }

  return (
    <ul className="space-y-3">
      {interactions.map((item) => (
        <li key={item.id} className="card-surface flex gap-3 rounded-md p-3.5">
          <UserAvatar name={item.author?.full_name ?? "—"} src={item.author?.avatar_url ?? null} profileId={item.author?.id} className="size-8 shrink-0" />
          <div className="min-w-0 space-y-0.5">
            <p className="flex flex-wrap items-center gap-x-2 text-[13px] font-semibold text-muted-foreground">
              <ChannelIcon channel={item.channel} />
              <span>{INTERACTION_KIND_LABELS[item.kind]}</span>
              {item.channel ? <span>· {INTERACTION_CHANNEL_LABELS[item.channel]}</span> : null}
              <span>· {item.author?.full_name ?? "Sistema"}</span>
              <span className="font-normal">· {formatRelativeTime(item.occurred_at)}</span>
            </p>
            <p className="text-sm">
              <Link href={`/crm?aba=leads&negocio=${item.deal_id}`} className="font-semibold hover:underline">
                {item.company_name} — {item.deal_title}
              </Link>
              <span className="text-muted-foreground"> · {DEAL_STAGE_LABELS[item.stage]}</span>
            </p>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{item.body}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
