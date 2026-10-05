import { Clock, ExternalLink, ListChecks, Repeat } from "lucide-react";
import { FREQUENCY_LABELS, type ProcessDetail } from "@/features/processes/types";

/** Total de passos, tempo estimado, sistemas externos envolvidos e frequência. */
export function ProcessSummary({ process }: { process: ProcessDetail }) {
  const steps = process.steps.filter((step) => !step.archived);
  const minutes = steps.reduce((total, step) => total + (step.estimatedMinutes ?? 0), 0);
  const time = minutes === 0 ? "—" : minutes < 60 ? `~${minutes} min` : `~${Math.floor(minutes / 60)}h${minutes % 60 ? String(minutes % 60).padStart(2, "0") : ""}`;
  // Sistemas externos distintos: pelo endereço; passos externos sem link contam como um só.
  const hosts = new Set<string>();
  let unnamed = false;
  for (const step of steps) {
    if (step.systemLink && /^https?:\/\//i.test(step.systemLink)) {
      try {
        hosts.add(new URL(step.systemLink).hostname);
      } catch {
        unnamed = true;
      }
    } else if (step.systemArea === "externo") unnamed = true;
  }
  const externals = hosts.size + (unnamed ? 1 : 0);
  const items = [
    { icon: ListChecks, label: "Passos", value: String(steps.length) },
    { icon: Clock, label: "Tempo estimado", value: time },
    { icon: ExternalLink, label: "Sistemas externos", value: externals === 0 ? "Nenhum" : String(externals) },
    { icon: Repeat, label: "Frequência", value: FREQUENCY_LABELS[process.frequency] },
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map(({ icon: Icon, label, value }) => (
        <div key={label} className="rounded-lg border border-border bg-surface-raised px-3 py-2.5">
          <dt className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <Icon className="size-3.5" aria-hidden />
            {label}
          </dt>
          <dd className="mt-0.5 font-display text-lg font-black tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
