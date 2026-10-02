"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Archive, Trash2 } from "lucide-react";
import { getPautaDetailAction } from "@/features/pautas/actions";
import { PautaActivityTab } from "@/features/pautas/components/pauta-activity-tab";
import { PautaCommentsTab } from "@/features/pautas/components/pauta-comments-tab";
import { PautaDetailsTab } from "@/features/pautas/components/pauta-details-tab";
import { PautaLogsTab } from "@/features/pautas/components/pauta-logs-tab";
import { PautaRemoveDialog, type PautaRemoval } from "@/features/pautas/components/pauta-remove-dialogs";
import { StandaloneTaskDetailsTab } from "@/features/pautas/components/standalone-task-details-tab";
import type { PautaDetail, PautaFormOptions } from "@/features/pautas/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { TabBar } from "@/components/ui/tab-bar";
import type { PautaWithDetails, Squad } from "@/types";

interface PautaDetailModalProps {
  pautaId: string;
  options: PautaFormOptions;
  canManage: boolean;
  currentUser: { id: string; full_name: string; avatar_url: string | null; managedSquads?: readonly Squad[] };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: (pauta: PautaWithDetails) => void;
  /** Depois de apagar ou arquivar: tira a pauta da lista de quem abriu o modal. */
  onRemoved?: (id: string) => void;
}

type TabKey = "detalhes" | "registros" | "comentarios" | "atividade";

export function PautaDetailModal({ pautaId, options, canManage, currentUser, open, onOpenChange, onChanged, onRemoved }: PautaDetailModalProps) {
  const [detail, setDetail] = useState<PautaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("detalhes");
  const [removal, setRemoval] = useState<PautaRemoval | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setTab("detalhes");
    getPautaDetailAction(pautaId).then((data) => {
      if (active) {
        setDetail(data);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [pautaId]);

  function reload() {
    getPautaDetailAction(pautaId).then((data) => {
      if (data) setDetail(data);
    });
  }

  function handleChanged(pauta: PautaWithDetails) {
    setDetail((current) => (current ? { ...current, pauta: { ...current.pauta, ...pauta } } : current));
    onChanged(pauta);
    // Registros e atividade mudam junto (ex.: "passar adiante" grava a nota como registro).
    reload();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85dvh] max-w-3xl flex-col">
        {loading || !detail ? (
          <div className="space-y-4" role="status" aria-label="Carregando pauta">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <>
            <DialogHeader>
              <p className="eyebrow flex items-center gap-2">
                {detail.pauta.is_standalone ? (
                  <span>Tarefa avulsa</span>
                ) : (
                  <>
                    {detail.pauta.code}
                    {detail.pauta.company_id ? (
                      <Link href={`/clientes/${detail.pauta.company_id}`} className="underline underline-offset-4 hover:text-foreground">
                        {detail.pauta.company_name}
                      </Link>
                    ) : (
                      <span>Interno — Além Filmes</span>
                    )}
                    {detail.pauta.project_id ? (
                      <>
                        <span aria-hidden>·</span>
                        <Link href={`/projetos/${detail.pauta.project_id}`} className="underline underline-offset-4 hover:text-foreground">
                          {detail.pauta.project_name}
                        </Link>
                      </>
                    ) : null}
                  </>
                )}
                {detail.pauta.is_critical ? (
                  <Badge variant="outline" className="border-2 border-foreground font-bold">
                    Crítica
                  </Badge>
                ) : null}
              </p>
              <DialogTitle>{detail.pauta.title}</DialogTitle>
              {(() => {
                // Apagar: só quem criou. Arquivar: gestão plena ou quem criou (a diretoria arquiva o que não criou).
                const isCreator = detail.pauta.created_by === currentUser.id;
                const canArchive = canManage || isCreator;
                if (!isCreator && !canArchive) return null;
                const title = detail.pauta.title ?? "";
                return (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {canArchive ? (
                      <Button type="button" size="sm" variant="ghost" onClick={() => setRemoval({ mode: "archive", id: pautaId, title })}>
                        <Archive aria-hidden />
                        Arquivar
                      </Button>
                    ) : null}
                    {isCreator ? (
                      <Button type="button" size="sm" variant="ghost" onClick={() => setRemoval({ mode: "delete", id: pautaId, title })}>
                        <Trash2 aria-hidden />
                        Apagar
                      </Button>
                    ) : null}
                  </div>
                );
              })()}
            </DialogHeader>

            <TabBar<TabKey>
              label="Seções da pauta"
              value={tab}
              onChange={setTab}
              tabs={[
                { value: "detalhes", label: "Detalhes" },
                { value: "registros", label: `Registros${detail.logs.length ? ` (${detail.logs.length})` : ""}` },
                { value: "comentarios", label: `Comentários${detail.comments.length ? ` (${detail.comments.length})` : ""}` },
                { value: "atividade", label: "Atividade" },
              ]}
            />

            {/* -mx/px: folga para o anel colorido dos avatares não ser cortado pela rolagem. */}
            <div className="-mx-1.5 min-h-0 flex-1 overflow-y-auto px-1.5 pt-5">
              {tab === "detalhes" ? (
                detail.pauta.is_standalone ? (
                  <StandaloneTaskDetailsTab pauta={detail.pauta} onChanged={handleChanged} />
                ) : (
                  <PautaDetailsTab
                    detail={detail}
                    options={options}
                    // canManage (gestão plena — master/diretoria/head-de-audiovisual) habilita título,
                    // líder, prioridade e criticidade. canEditOperationally (gestão plena OU líder,
                    // responsável atual ou membro — a mesma regra de can_edit_pauta() no banco) habilita
                    // status e os campos operacionais da etapa. A RLS/trigger no banco são quem decidem
                    // de verdade; isto só evita mostrar controles que o servidor recusaria.
                    canManage={canManage}
                    canEditOperationally={
                      canManage ||
                      detail.pauta.lead_id === currentUser.id ||
                      detail.pauta.current_assignee_id === currentUser.id ||
                      detail.members.some((member) => member.profile_id === currentUser.id)
                    }
                    // Lápis (todos os dados): quem criou a pauta ou a gestão do squad dela.
                    canEditAll={
                      canManage ||
                      detail.pauta.created_by === currentUser.id ||
                      (currentUser.managedSquads ?? []).includes(detail.pauta.squad ?? "audiovisual")
                    }
                    // Aprovar: só quem criou a pauta (ou a gestão quando a pauta não tem mais autor).
                    canApprove={detail.pauta.created_by === currentUser.id || (canManage && !detail.pauta.created_by)}
                    onChanged={handleChanged}
                  />
                )
              ) : tab === "registros" ? (
                <PautaLogsTab
                  pautaId={pautaId}
                  squad={detail.pauta.squad}
                  logs={detail.logs}
                  canWrite={
                    canManage ||
                    detail.pauta.lead_id === currentUser.id ||
                    detail.pauta.current_assignee_id === currentUser.id ||
                    detail.pauta.created_by === currentUser.id ||
                    detail.pauta.created_for === currentUser.id ||
                    detail.members.some((member) => member.profile_id === currentUser.id)
                  }
                  onAdded={reload}
                />
              ) : tab === "comentarios" ? (
                <PautaCommentsTab
                  pautaId={pautaId}
                  comments={detail.comments}
                  currentUser={currentUser}
                  onAdded={(comment) => setDetail((current) => (current ? { ...current, comments: [...current.comments, comment] } : current))}
                />
              ) : (
                <PautaActivityTab history={detail.history} squad={detail.pauta.squad} />
              )}
            </div>
          </>
        )}
      </DialogContent>
      {removal ? (
        <PautaRemoveDialog
          removal={removal}
          onOpenChange={(next) => !next && setRemoval(null)}
          onDone={(id) => {
            onRemoved?.(id);
            onOpenChange(false);
          }}
        />
      ) : null}
    </Dialog>
  );
}
