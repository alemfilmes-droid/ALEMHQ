"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { StatusDot } from "@/components/ui/status-dot";
import { formatMinutes } from "@/features/time-tracking/format";
import type { TeamMemberStatus } from "@/features/time-tracking/types";
import { SQUAD_LABELS } from "@/lib/auth/squads";
import { SQUAD_TONE, toneColor } from "@/lib/status";

export function TeamTable({ members, yearMonth }: { members: TeamMemberStatus[]; yearMonth: string }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return members;
    return members.filter((member) => member.fullName.toLowerCase().includes(query));
  }, [members, search]);

  return (
    <div className="space-y-4">
      <Input placeholder="Buscar por nome" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Buscar pessoa" className="max-w-xs" />

      <ul className="divide-y divide-border rounded-lg border border-border bg-card">
        {filtered.map((member) => {
          const status = member.isWorking ? "Trabalhando" : member.hasRecordToday ? "Encerrado" : "Sem registro";
          return (
            <li key={member.profileId}>
              <Link
                href={`/banco-de-horas/${member.profileId}?mes=${yearMonth}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-3 p-4 outline-none transition-colors hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring md:flex-nowrap"
              >
                <UserAvatar name={member.fullName} src={member.avatarUrl} className="size-10" />

                <div className="min-w-0 flex-1 basis-40">
                  <p className="truncate text-sm font-bold">{member.fullName}</p>
                  <p className="truncate text-[13px] text-muted-foreground">{member.jobTitle ?? "—"}</p>
                </div>

                <ul className="flex w-full flex-wrap gap-1.5 md:w-40" aria-label="Squads">
                  {member.squads.map((squad) => (
                    <li key={squad}>
                      <Badge variant="muted">
                        <StatusDot tone={SQUAD_TONE[squad]} />
                        {SQUAD_LABELS[squad]}
                      </Badge>
                    </li>
                  ))}
                </ul>

                <div className="flex w-32 items-center gap-2 text-sm font-semibold">
                  <StatusDot tone={member.isWorking ? "success" : "neutral"} />
                  {status}
                </div>

                <div className="w-24 text-sm font-semibold">{formatMinutes(member.todayWorkedMinutes)}</div>

                <div
                  className="w-28 text-right text-sm font-bold"
                  style={{ color: toneColor(member.monthBalanceMinutes >= 0 ? "success" : "danger") }}
                >
                  {formatMinutes(member.monthBalanceMinutes)}
                </div>
              </Link>
            </li>
          );
        })}
        {filtered.length === 0 ? <li className="p-4 text-sm text-subtle">Nenhuma pessoa encontrada.</li> : null}
      </ul>
    </div>
  );
}
