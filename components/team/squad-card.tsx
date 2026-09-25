import { UserAvatar } from "@/components/ui/avatar";
import { StatusBar } from "@/components/ui/status-bar";
import { FUNCTION_LABELS, PRODUCTION_FUNCTIONS } from "@/lib/auth/roles";
import { SQUAD_LABELS } from "@/lib/auth/squads";
import { SQUAD_TONE } from "@/lib/status";
import type { ProductionFunction, ProfileWithSquads, Squad } from "@/types";

const NO_FUNCTION = "__none__";

interface SquadCardProps {
  squad: Squad;
  members: ProfileWithSquads[];
}

/** Agrupa por função principal (a primeira do array). Membro em mais de uma função aparece só uma vez. */
function groupByFunction(members: ProfileWithSquads[]) {
  const groups = new Map<string, ProfileWithSquads[]>();
  for (const member of members) {
    const key: string = member.functions[0] ?? NO_FUNCTION;
    groups.set(key, [...(groups.get(key) ?? []), member]);
  }
  const ordered: { label: string; members: ProfileWithSquads[] }[] = [];
  for (const fn of PRODUCTION_FUNCTIONS) {
    const bucket = groups.get(fn);
    if (bucket) ordered.push({ label: FUNCTION_LABELS[fn as ProductionFunction], members: bucket });
  }
  const noFunction = groups.get(NO_FUNCTION);
  if (noFunction) ordered.push({ label: "Sem função definida", members: noFunction });
  return ordered;
}

export function SquadCard({ squad, members }: SquadCardProps) {
  const groups = groupByFunction(members);

  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-card">
      <StatusBar tone={SQUAD_TONE[squad]} side="top" />
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <p className="font-display text-lg font-black tracking-tight">{SQUAD_LABELS[squad]}</p>
        <span className="text-xs font-semibold text-muted-foreground">
          {members.length} {members.length === 1 ? "pessoa" : "pessoas"}
        </span>
      </div>

      <div className="space-y-4 p-4">
        {groups.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">Ninguém neste squad ainda.</p>
        ) : (
          groups.map((group) => (
            <div key={group.label}>
              <p className="eyebrow mb-2">{group.label}</p>
              <ul className="space-y-2">
                {group.members.map((member) => (
                  <li key={member.id} className="flex items-center gap-2.5">
                    <UserAvatar name={member.full_name} src={member.avatar_url} className="size-7" />
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold leading-tight">{member.full_name}</p>
                      {member.job_title ? <p className="truncate text-[12px] leading-tight text-subtle">{member.job_title}</p> : null}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
