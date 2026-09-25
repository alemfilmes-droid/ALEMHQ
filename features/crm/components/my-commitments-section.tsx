import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { StatusDot } from "@/components/ui/status-dot";
import { COMMITMENT_KIND_LABELS } from "@/features/crm/labels";
import { listMyCommitments } from "@/features/crm/queries";
import { formatDateTime } from "@/lib/format";

/** Compromissos da agenda interna de quem está no quadro pessoal (reuniões comerciais, captações...). Some se não houver nenhum. */
export async function MyCommitmentsSection({ profileId }: { profileId: string }) {
  const commitments = await listMyCommitments(profileId, 6);
  if (commitments.length === 0) return null;

  return (
    <section aria-labelledby="compromissos-title" className="space-y-3">
      <h2 id="compromissos-title" className="section-title flex items-center gap-2">
        <CalendarClock className="size-4" aria-hidden />
        Compromissos
      </h2>
      <ul className="grid gap-2 sm:grid-cols-2">
        {commitments.map((item) => (
          <li key={item.id} className="rounded-md border border-border bg-card px-4 py-3">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <StatusDot tone="neutral" />
              {item.deal_id ? (
                <Link href={`/crm?aba=leads&negocio=${item.deal_id}`} className="hover:underline">
                  {item.title}
                </Link>
              ) : (
                item.title
              )}
            </p>
            <p className="pl-4 text-[12px] text-subtle">
              {formatDateTime(item.starts_at)} · {COMMITMENT_KIND_LABELS[item.kind]}
              {item.location_or_link ? ` · ${item.location_or_link}` : ""}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
