import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeading } from "@/components/ui/card";
import type { ObjectionReport } from "@/features/prospeccao/report-queries";
import type { ReportPeriod } from "@/lib/prospeccao/objection-report";
import { cn } from "@/lib/utils";

const PERIODS: { key: ReportPeriod; label: string }[] = [
  { key: "30d", label: "Últimos 30 dias" },
  { key: "trimestre", label: "Trimestre" },
  { key: "tudo", label: "Tudo" },
];

const percent = (value: number | null) => (value === null ? "—" : `${Math.round(value * 100)}%`);

/** Relatórios › Objeções (spec 5): ranking, por playbook e quantos leads chegaram a reunião depois. */
export function ObjectionReportView({ report, period, hrefFor }: { report: ObjectionReport; period: ReportPeriod; hrefFor: (period: ReportPeriod) => string }) {
  const max = Math.max(1, ...report.rows.map((row) => row.total));
  const chip = (active: boolean) =>
    cn(
      "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold transition-colors",
      active ? "border-foreground bg-foreground text-background" : "border-border-strong text-muted-foreground hover:text-foreground",
    );

  return (
    <section className="space-y-4" aria-labelledby="relatorio-objecoes">
      <h2 id="relatorio-objecoes" className="text-lg font-bold text-foreground">
        Objeções
      </h2>
      <nav aria-label="Período" className="flex flex-wrap gap-2">
        {PERIODS.map((item) => (
          <Link key={item.key} href={hrefFor(item.key)} className={chip(item.key === period)} aria-current={item.key === period ? "page" : undefined}>
            {item.label}
          </Link>
        ))}
      </nav>

      {report.rows.length === 0 ? (
        <p className="rounded-lg border border-border p-6 text-center text-sm text-muted-foreground">Nenhuma objeção registrada neste período.</p>
      ) : (
        <ol className="grid gap-3">
          {report.rows.map((row, index) => (
            <li key={row.id}>
              <Card variant="static">
                <CardHeading icon={ShieldAlert} tone="slate" title={`${index + 1}º · ${row.label}`} action={<span className="font-mono text-[13px] text-muted-foreground">{row.shortcut}</span>} />
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <p className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Registros</span>
                      <span className="font-bold tabular-nums text-foreground">{row.total}</span>
                    </p>
                    <div className="h-2.5 overflow-hidden rounded-full bg-surface-hover" aria-hidden>
                      <span className="block h-full rounded-full bg-foreground" style={{ width: `${(row.total / max) * 100}%` }} />
                    </div>
                  </div>
                  <dl className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <dt className="text-[13px] text-muted-foreground">Leads</dt>
                      <dd className="font-bold tabular-nums text-foreground">{row.leads}</dd>
                    </div>
                    <div>
                      <dt className="text-[13px] text-muted-foreground">Reunião depois</dt>
                      <dd className="font-bold tabular-nums text-foreground">{row.leadsWithMeeting}</dd>
                    </div>
                    <div>
                      <dt className="text-[13px] text-muted-foreground">Conversão</dt>
                      <dd className="font-bold tabular-nums text-foreground">{percent(row.conversion)}</dd>
                    </div>
                  </dl>
                  <div>
                    <p className="mb-1 text-[13px] font-semibold text-muted-foreground">Por playbook</p>
                    <ul className="flex flex-wrap gap-2">
                      {row.byPlaybook.map((item) => (
                        <li key={item.playbookId ?? "sem"} className="rounded-full border border-border-strong px-3 py-1 text-[13px] text-foreground">
                          {item.playbookId ? (report.playbookNames[item.playbookId] ?? "Playbook") : "Sem playbook"} · {item.total}
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      )}
      <p className="text-[13px] text-muted-foreground">Conversão = leads com reunião marcada depois da objeção ÷ leads com a objeção.</p>
    </section>
  );
}
