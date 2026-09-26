import { Users } from "lucide-react";
import { UserAvatar } from "@/components/ui/avatar";
import { CardIcon } from "@/components/ui/card";
import { ORG_LEVELS } from "@/lib/auth/org";
import { FUNCTION_LABELS } from "@/lib/auth/roles";
import { SQUAD_LABELS } from "@/lib/auth/squads";
import { SQUAD_TONE } from "@/lib/status";
import { SURFACE, squadBarStyle } from "@/lib/theme";
import { cn } from "@/lib/utils";
import type { ProfileWithSquads, Squad } from "@/types";

const NO_TITLE = "Sem cargo definido";

interface SquadCardProps {
  squad: Squad;
  members: ProfileWithSquads[];
}

/**
 * Agrupa por CARGO (profiles.job_title: CEO, Head Comercial, Filmmaker…). Cargos mais altos primeiro
 * (pelo nível hierárquico de quem o ocupa), depois em ordem alfabética; quem não tem cargo vai por
 * último. As funções de produção (captação, edição, motion) aparecem como "Atuação", ao lado do nome.
 */
function groupByTitle(members: ProfileWithSquads[]) {
  const groups = new Map<string, ProfileWithSquads[]>();
  for (const member of members) {
    const key = member.job_title?.trim() || NO_TITLE;
    groups.set(key, [...(groups.get(key) ?? []), member]);
  }
  const rank = (list: ProfileWithSquads[]) => Math.min(...list.map((member) => ORG_LEVELS.indexOf(member.org_level)));
  return [...groups.entries()]
    .map(([label, list]) => ({ label, members: list.sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-BR")) }))
    .sort((a, b) => {
      if (a.label === NO_TITLE) return 1;
      if (b.label === NO_TITLE) return -1;
      return rank(a.members) - rank(b.members) || a.label.localeCompare(b.label, "pt-BR");
    });
}

export function SquadCard({ squad, members }: SquadCardProps) {
  const groups = groupByTitle(members);

  return (
    <div className={cn(SURFACE.card, "relative overflow-hidden rounded-lg")}>
      <span aria-hidden className="absolute inset-x-0 top-0 h-[3px]" style={squadBarStyle(squad)} />
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <span className="flex items-center gap-3">
          <CardIcon icon={Users} tone={SQUAD_TONE[squad]} />
          <span className="font-display text-lg font-black tracking-tight">{SQUAD_LABELS[squad]}</span>
        </span>
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
              <ul className="space-y-2.5">
                {group.members.map((member) => (
                  <li key={member.id} className="flex items-center gap-2.5">
                    <UserAvatar name={member.full_name} src={member.avatar_url} squads={member.squads} className="size-7" />
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold leading-tight">{member.full_name}</p>
                      {member.functions.length > 0 ? (
                        <p className="truncate text-[12px] leading-tight text-subtle" title="Atuação">
                          {member.functions.map((fn) => FUNCTION_LABELS[fn]).join(" · ")}
                        </p>
                      ) : null}
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
