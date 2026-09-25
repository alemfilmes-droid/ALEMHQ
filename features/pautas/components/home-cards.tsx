import Link from "next/link";
import { ListChecks } from "lucide-react";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getHomePautaSummary } from "@/features/minhas-pautas/queries";
import { formatDate } from "@/lib/format";
import { Metric, MetricGrid } from "@/components/ui/metric-value";

const CARD_CLASS =
  "card-elevated block rounded-lg border outline-none transition-colors hover:border-border-strong focus-visible:ring-2 focus-visible:ring-ring";

/** "Minhas Pautas" — atrasadas, hoje e a próxima pauta com prazo, tudo apontando para o quadro pessoal. */
export async function PautaHomeCards({ profileId }: { profileId: string }) {
  const summary = await getHomePautaSummary(profileId);

  return (
    <Link href="/minhas-pautas" className={CARD_CLASS}>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm text-muted-foreground">Minhas Pautas</CardTitle>
        <ListChecks className="size-4 text-subtle" aria-hidden />
      </CardHeader>
      <CardContent className="min-w-0">
        <MetricGrid min="6rem">
          <Metric label="Atrasadas" value={summary.atrasadas} size="lg" tone={summary.atrasadas > 0 ? "danger" : undefined} />
          <Metric label="Hoje" value={summary.hoje} size="lg" tone={summary.hoje > 0 ? "warning" : undefined} />
        </MetricGrid>
        <p className="mt-3 break-words text-xs text-subtle">
          {summary.nextDue ? `Próxima: ${summary.nextDue.title}${summary.nextDue.dueDate ? ` — vence ${formatDate(summary.nextDue.dueDate)}` : ""}` : "Nada com você agora."}
        </p>
      </CardContent>
    </Link>
  );
}
