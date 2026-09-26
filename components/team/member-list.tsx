import { UserX } from "lucide-react";
import { FinanceSwitch } from "@/components/team/finance-switch";
import { MemberActions } from "@/components/team/member-actions";
import { UserAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { SquadBadge } from "@/components/ui/squad-badge";
import { ORG_LEVEL_LABELS } from "@/lib/auth/org";
import { FUNCTION_LABELS, ROLE_LABELS } from "@/lib/auth/roles";
import type { ProfileWithSquads } from "@/types";

interface MemberListProps {
  members: ProfileWithSquads[];
  viewer: ProfileWithSquads;
  /** Ações de gestão (editar, desativar, financeiro) só existem para admin — o resto é leitura. */
  viewerIsAdmin: boolean;
  /** O switch "Acesso ao financeiro" também exige que o admin tenha acesso ao financeiro. */
  viewerHasFinance: boolean;
}

export function MemberList({ members, viewer, viewerIsAdmin, viewerHasFinance }: MemberListProps) {
  return (
    <ul className="card-surface card-static divide-y divide-border rounded-lg">
      {members.map((member) => (
        <li key={member.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 p-4 md:flex-nowrap">
          <UserAvatar name={member.full_name} src={member.avatar_url} squads={member.squads} className="size-10" />

          <div className="min-w-0 flex-1 basis-40">
            <p className={`truncate text-sm font-bold ${member.is_active ? "" : "text-muted-foreground line-through"}`}>
              {member.full_name}
              {member.id === viewer.id ? <span className="ml-2 font-normal text-subtle no-underline">(você)</span> : null}
            </p>
            <p className="truncate text-[13px] text-muted-foreground">
              <span className="text-subtle">Cargo: </span>
              <span className="font-semibold text-foreground">{member.job_title || "não definido"}</span>
            </p>
            <p className="truncate text-[12px] text-subtle">{member.email}</p>
          </div>

          <div className="flex w-full flex-wrap gap-1.5 md:w-40">
            <Badge variant={member.access_role === "admin" ? "solid" : "outline"}>{ROLE_LABELS[member.access_role]}</Badge>
            <Badge variant={member.org_level === "master" ? "solid" : "outline"}>{ORG_LEVEL_LABELS[member.org_level]}</Badge>
          </div>

          <ul className="flex w-full flex-wrap gap-1.5 md:w-44" aria-label="Squads">
            {member.squads.length > 0 ? (
              member.squads.map((squad) => (
                <li key={squad}>
                  <SquadBadge squad={squad} />
                </li>
              ))
            ) : (
              <li className="text-[13px] text-subtle">Sem squad</li>
            )}
          </ul>

          <ul className="flex w-full flex-wrap items-center gap-1.5 md:w-64" aria-label="Atuação">
            <li className="eyebrow mr-0.5 text-[10px]">Atuação</li>
            {member.functions.length > 0 ? (
              member.functions.map((fn) => (
                <li key={fn}>
                  <Badge variant="muted">{FUNCTION_LABELS[fn]}</Badge>
                </li>
              ))
            ) : (
              <li className="text-[13px] text-subtle">—</li>
            )}
          </ul>

          <div className="w-24 text-[13px]">
            {member.is_active ? (
              <span className="font-semibold">Ativo</span>
            ) : (
              <span className="inline-flex items-center gap-1 font-semibold text-muted-foreground">
                <UserX className="size-3.5" aria-hidden />
                Desativado
              </span>
            )}
          </div>

          {viewerIsAdmin && viewerHasFinance ? (
            <div className="w-full md:w-32">
              <FinanceSwitch member={member} isSelf={member.id === viewer.id} />
            </div>
          ) : null}

          <div className="ml-auto">
            <MemberActions member={member} viewer={viewer} viewerIsAdmin={viewerIsAdmin} isSelf={member.id === viewer.id} />
          </div>
        </li>
      ))}
    </ul>
  );
}
