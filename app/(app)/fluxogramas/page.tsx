import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { ProcessesBrowser } from "@/features/processes/components/processes-browser";
import { listProcesses } from "@/features/processes/queries";
import { canEditProcessSquad, canReadAllProcesses } from "@/lib/auth/permissions";
import { requireProfile } from "@/lib/auth/session";
import { SQUADS } from "@/lib/auth/squads";

export const metadata: Metadata = { title: "Fluxogramas" };

export default async function ProcessesPage() {
  const profile = await requireProfile();
  // A RLS já devolve só os processos dos squads da pessoa (todos para diretoria/master).
  const processes = await listProcesses();
  const visibleSquads = canReadAllProcesses(profile) ? [...SQUADS] : SQUADS.filter((squad) => profile.squads.includes(squad));
  const editableSquads = SQUADS.filter((squad) => canEditProcessSquad(profile, squad));

  return (
    <>
      <PageHeader
        panel="/fluxogramas"
        eyebrow="Empresa"
        title="Fluxogramas."
        description="O manual de operação da Além: como cada processo é feito, passo a passo, por squad. Leia no celular, no set, ou execute marcando cada passo."
      />
      <ProcessesBrowser processes={processes} squads={visibleSquads} editableSquads={editableSquads} />
    </>
  );
}
