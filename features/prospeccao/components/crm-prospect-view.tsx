import Link from "next/link";
import { ProspectQueue } from "@/features/prospeccao/components/prospect-queue";
import { loadCadenceContext } from "@/features/prospeccao/cadence-queries";
import { demoQueueItems } from "@/features/prospeccao/demo";
import { listProspectItems } from "@/features/prospeccao/queue-queries";
import { CADENCE_STATUS_LABELS } from "@/features/prospeccao/status";
import type { ObjectionOption, QueueItem } from "@/features/prospeccao/types";
import { CADENCE_STATUSES, isDueNow, type CadenceStatus } from "@/lib/prospeccao/cadence";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export type LeadsView = "chamar-hoje" | "prospeccao" | "todos";

export interface Queue {
  items: QueueItem[];
  today: string;
  objections: ObjectionOption[];
}

export async function loadQueue(demo: boolean): Promise<Queue> {
  const supabase = await createClient();
  const [context, objections] = await Promise.all([
    loadCadenceContext(supabase),
    supabase.from("prospect_objections").select("id, shortcut, label, response_body, hq_action").eq("active", true).order("position"),
  ]);
  return {
    items: demo ? demoQueueItems(context.today, context.calendar) : await listProspectItems(),
    today: context.today,
    objections: (objections.data ?? []).map((row) => ({ id: row.id, shortcut: row.shortcut, label: row.label, responseBody: row.response_body, hqAction: row.hq_action })),
  };
}

interface Props {
  view: Exclude<LeadsView, "todos">;
  status: string | undefined;
  /** "1" = só clientes da casa. */
  house: string | undefined;
  /** "12 de 20 toques hoje · 3 de 5 reuniões na semana" (esforço de quem está vendo). */
  effortLine: string | null;
  /** Monta o link da visão mantendo os outros parâmetros (ex.: ?demo=1). */
  hrefFor: (params: Record<string, string | undefined>) => string;
  queue: Queue;
  /** Squad comercial e master agem; os demais só veem. */
  canAct: boolean;
}

/** "Chamar hoje" (fila) e "Prospecção" (todos os leads com playbook, filtráveis por status). */
export function CrmProspectView({ view, status, house, effortLine, hrefFor, queue, canAct }: Props) {
  const { items, today, objections } = queue;

  if (view === "chamar-hoje") {
    const due = items.filter((item) => isDueNow(item.state));
    const toConfirm = items.filter((item) => item.meeting?.awaitingOutcome);
    return (
      <section className="space-y-3" aria-labelledby="chamar-hoje-titulo">
        {toConfirm.length ? (
          <div className="space-y-3 pb-3">
            <h2 className="text-lg font-bold text-foreground">{toConfirm.length === 1 ? "1 reunião para confirmar" : `${toConfirm.length} reuniões para confirmar`}</h2>
            <ProspectQueue items={toConfirm} today={today} canAct={canAct} objections={objections} empty="" />
          </div>
        ) : null}
        <h2 id="chamar-hoje-titulo" className="text-lg font-bold text-foreground">
          {due.length === 1 ? "1 toque para hoje" : `${due.length} toques para hoje`}
        </h2>
        {effortLine ? <p className="text-sm font-semibold text-foreground">{effortLine}</p> : null}
        <p className="text-[13px] text-muted-foreground">Atrasados primeiro. Horário sugerido: 9h–11h e 14h–16h.</p>
        <ProspectQueue items={due} today={today} canAct={canAct} objections={objections} empty="Nenhum toque para hoje. Os próximos aparecem em Prospecção." />
      </section>
    );
  }

  const selected = CADENCE_STATUSES.find((item) => item === status);
  const counts = new Map<CadenceStatus, number>();
  for (const item of items) counts.set(item.state.status, (counts.get(item.state.status) ?? 0) + 1);
  const onlyHouse = house === "1";
  const houseCount = items.filter((item) => item.house).length;
  const visible = items.filter((item) => (!selected || item.state.status === selected) && (!onlyHouse || item.house));
  const chip = (active: boolean) =>
    cn(
      "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold transition-colors",
      active ? "border-foreground bg-foreground text-background" : "border-border-strong text-muted-foreground hover:text-foreground",
    );

  return (
    <section className="space-y-4" aria-label="Leads da prospecção">
      <nav aria-label="Filtrar por status" className="flex flex-wrap gap-2">
        <Link href={hrefFor({ status: undefined })} className={chip(!selected && !onlyHouse)} aria-current={!selected && !onlyHouse ? "page" : undefined}>
          Todos · {items.length}
        </Link>
        {CADENCE_STATUSES.filter((item) => counts.has(item)).map((item) => (
          <Link key={item} href={hrefFor({ status: item })} className={chip(selected === item)} aria-current={selected === item ? "page" : undefined}>
            {CADENCE_STATUS_LABELS[item]} · {counts.get(item)}
          </Link>
        ))}
        {houseCount ? (
          <Link href={hrefFor({ casa: onlyHouse ? undefined : "1" })} className={chip(onlyHouse)} aria-current={onlyHouse ? "page" : undefined}>
            Cliente da casa · {houseCount}
          </Link>
        ) : null}
      </nav>
      <ProspectQueue items={visible} today={today} canAct={canAct} objections={objections} empty="Nenhum lead com playbook. Cadastre um lead com playbook em + Novo negócio." />
    </section>
  );
}
