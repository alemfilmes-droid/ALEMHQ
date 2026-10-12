import { Activity } from "lucide-react";
import { Card, CardContent, CardHeading } from "@/components/ui/card";
import type { Effort } from "@/features/prospeccao/effort-queries";

/** Barra neutra com o número sempre escrito (nunca só cor; sem o vermelho da marca). */
function EffortBar({ label, value, target }: { label: string; value: number; target: number }) {
  const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
  return (
    <div className="space-y-1.5">
      <p className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-bold tabular-nums text-foreground">
          {value}
          {target > 0 ? ` de ${target}` : ""}
        </span>
      </p>
      {target > 0 ? (
        <div
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={target}
          aria-valuenow={value}
          className="h-2.5 w-full overflow-hidden rounded-full bg-surface-hover"
        >
          <span className="block h-full rounded-full bg-foreground" style={{ width: `${pct}%` }} />
        </div>
      ) : null}
    </div>
  );
}

/** Metas de esforço da prospecção (spec 7.3): calculadas do histórico, não lançadas à mão. */
export function EffortPanel({ effort }: { effort: Effort }) {
  if (effort.people.length === 0) return null;
  return (
    <Card variant="static" className="mb-6">
      <CardHeading icon={Activity} tone="slate" title="Esforço da prospecção · calculado pelo CRM" />
      <CardContent>
        <ul className="grid gap-5 md:grid-cols-2">
          {effort.people.map((person) => (
            <li key={person.id} className="space-y-3 rounded-md border border-border p-4">
              <p className="font-bold text-foreground">{person.name}</p>
              <EffortBar label="Toques enviados hoje" value={person.touchesToday} target={effort.touchTarget} />
              <EffortBar label="Reuniões marcadas na semana" value={person.meetingsWeek} target={effort.meetingTarget} />
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[13px] text-muted-foreground">Os alvos ficam em Configurações › Prospecção › Geral. A semana vai de segunda a domingo.</p>
      </CardContent>
    </Card>
  );
}
