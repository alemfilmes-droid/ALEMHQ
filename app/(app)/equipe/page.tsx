import type { Metadata } from "next";
import { Suspense } from "react";
import { AlertCircle, Eye, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { InviteDialog } from "@/components/team/invite-dialog";
import { MemberList } from "@/components/team/member-list";
import { PendingInvitations } from "@/components/team/pending-invitations";
import { SquadBoard } from "@/components/team/squad-board";
import { TeamFilters } from "@/components/team/team-filters";
import { TransferMasterDialog } from "@/components/team/transfer-master-dialog";
import { can, hasCapability } from "@/lib/auth/permissions";
import { ACCESS_ROLES, PRODUCTION_FUNCTIONS } from "@/lib/auth/roles";
import { requireProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { AccessRole, ProductionFunction, ProfileWithSquads, Squad } from "@/types";

export const metadata: Metadata = { title: "Equipe" };

type SearchParams = Promise<{ papel?: string; funcao?: string }>;

export default async function TeamPage({ searchParams }: { searchParams: SearchParams }) {
  const current = await requireProfile();
  const isAdmin = can(current.access_role, "team:invite");
  const { papel, funcao } = await searchParams;
  const role = ACCESS_ROLES.find((item): item is AccessRole => item === papel);
  const fn = PRODUCTION_FUNCTIONS.find((item): item is ProductionFunction => item === funcao);

  const supabase = await createClient();
  await supabase.rpc("expire_stale_invitations");

  let membersQuery = supabase.from("profiles").select("*, profile_squads(squad, is_lead)").order("full_name");
  if (role) membersQuery = membersQuery.eq("access_role", role);
  if (fn) membersQuery = membersQuery.contains("functions", [fn]);

  const [membersResult, invitationsResult] = await Promise.all([
    membersQuery,
    supabase.from("invitations").select("*").in("status", ["pending", "expired"]).order("created_at", { ascending: false }),
  ]);

  const invitations = invitationsResult.data ?? [];
  // Convidados que ainda não aceitaram já têm profile; eles aparecem só em "Convites".
  const openInviteEmails = new Set(invitations.map((invitation) => invitation.email));
  const members: ProfileWithSquads[] = (membersResult.data ?? [])
    .filter((member) => !openInviteEmails.has(member.email))
    .map(({ profile_squads, ...member }) => ({
      ...member,
      squads: profile_squads.map((row) => row.squad as Squad),
      leadSquads: profile_squads.filter((row) => row.is_lead).map((row) => row.squad as Squad),
    }));
  const hasFilters = Boolean(role || fn);

  return (
    <>
      <PageHeader
        panel="/equipe"
        eyebrow="Empresa"
        title="Equipe."
        description="Squads, papéis e funções de quem acessa o Além HQ."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            {current.org_level === "master" ? <TransferMasterDialog candidates={members.filter((m) => m.id !== current.id && m.is_active)} /> : null}
            {isAdmin ? <InviteDialog /> : null}
          </div>
        }
      />

      <section aria-labelledby="board-title" className="mb-12 space-y-4">
        <div className="flex items-center justify-between">
          <h2 id="board-title" className="section-title">
            Squads
          </h2>
          {isAdmin ? null : (
            <span className="flex items-center gap-1.5 text-[12px] font-semibold text-subtle">
              <Eye className="size-3.5" aria-hidden />
              Somente leitura
            </span>
          )}
        </div>
        <SquadBoard members={members} />
      </section>

      <section aria-labelledby="members-title" className="space-y-4">
        <h2 id="members-title" className="section-title">
          Pessoas
        </h2>
        <Suspense>
          <TeamFilters />
        </Suspense>

        {membersResult.error ? (
          <div role="alert" className="flex items-center gap-3 rounded-lg border-2 border-foreground p-4 text-sm font-semibold">
            <AlertCircle className="size-4 shrink-0" aria-hidden />
            Não foi possível carregar a equipe. Recarregue a página.
          </div>
        ) : members.length === 0 ? (
          <div className="flex flex-col items-center rounded-lg border border-dashed border-border-strong px-6 py-16 text-center">
            <Users className="mb-3 size-6 text-muted-foreground" aria-hidden />
            <p className="font-bold">{hasFilters ? "Nenhuma pessoa com esses filtros." : "Nenhuma pessoa na equipe."}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {hasFilters ? "Ajuste ou limpe os filtros." : "Use “Convidar pessoa” para começar."}
            </p>
          </div>
        ) : (
          <MemberList
            members={members}
            viewer={current}
            viewerIsAdmin={isAdmin}
            viewerHasFinance={hasCapability(current, "finance")}
          />
        )}
      </section>

      {isAdmin ? (
        <section aria-labelledby="invites-title" className="mt-12 space-y-4">
          <h2 id="invites-title" className="section-title">
            Convites pendentes
          </h2>
          <PendingInvitations invitations={invitations} />
        </section>
      ) : null}
    </>
  );
}
