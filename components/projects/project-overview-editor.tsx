"use client";

import { updateProjectAction } from "@/app/(app)/projetos/actions";
import { ContactCard } from "@/components/companies/contact-card";
import { InlineContactSelect } from "@/components/projects/inline-contact-select";
import { InlineOwnerSelect } from "@/components/projects/inline-owner-select";
import { InlinePrioritySelect } from "@/components/projects/inline-priority-select";
import { MembersEditDialog } from "@/components/projects/members-edit-dialog";
import { ServiceTypesEditDialog } from "@/components/projects/service-types-edit-dialog";
import { Badge } from "@/components/ui/badge";
import { InlineDate } from "@/components/ui/inline-date";
import { InlineEditable } from "@/components/ui/inline-editable";
import { UserAvatar } from "@/components/ui/avatar";
import { SERVICE_TYPE_LABELS } from "@/lib/domain";
import { formatDate } from "@/lib/format";
import type { ActionResult, Contact, ProjectModel, ProjectPriority, ServiceType } from "@/types";

interface MemberOption {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

interface ProjectOverviewEditorProps {
  projectId: string;
  canManage: boolean;
  isInternal: boolean;
  model: ProjectModel;
  contact: Contact | null;
  contactOptions: { id: string; full_name: string }[];
  priority: ProjectPriority;
  serviceTypes: ServiceType[];
  ownerId: string;
  memberOptions: MemberOption[];
  memberIds: string[];
  memberProfiles: MemberOption[];
  startDate: string | null;
  dueDate: string | null;
  endDate: string | null;
  briefing: string | null;
  productionNotes: string | null;
  locationAddress: string | null;
  locationNotes: string | null;
  includedRevisionRounds: number | null;
  driveFolderUrl: string | null;
  deliveryNotes: string | null;
}

/**
 * Toda a Visão geral editável do projeto num só componente cliente. Precisa ser cliente porque
 * `onSave` é uma closure em cima de uma server action — uma Server Component não pode passar essa
 * closure como prop para um componente cliente, só dados serializáveis (por isso este componente
 * recebe os campos do projeto prontos, e ele mesmo chama updateProjectAction()).
 */
export function ProjectOverviewEditor(props: ProjectOverviewEditorProps) {
  const { projectId, canManage } = props;

  async function save(patch: Parameters<typeof updateProjectAction>[1]): Promise<ActionResult> {
    return updateProjectAction(projectId, patch);
  }

  return (
    <div className="space-y-8">
      <section aria-labelledby="resumo-title" className="space-y-4">
        <h2 id="resumo-title" className="section-title">
          Resumo
        </h2>
        <dl className="card-grid text-sm">
          {props.isInternal ? null : (
            <div className="rounded-lg border border-border bg-card p-4">
              <dt className="eyebrow">Contato</dt>
              <dd className="mt-2">
                <InlineContactSelect projectId={projectId} value={props.contact?.id ?? null} contacts={props.contactOptions} disabled={!canManage} />
                {props.contact ? (
                  <div className="mt-2">
                    <ContactCard contact={props.contact} canManage={canManage} />
                  </div>
                ) : null}
              </dd>
            </div>
          )}
          <div className="rounded-lg border border-border bg-card p-4">
            <dt className="eyebrow">Prioridade</dt>
            <dd className="mt-2">
              <InlinePrioritySelect projectId={projectId} value={props.priority} disabled={!canManage} />
            </dd>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <dt className="flex items-center justify-between">
              <span className="eyebrow">Tipo de projeto</span>
              {canManage ? <ServiceTypesEditDialog projectId={projectId} serviceTypes={props.serviceTypes} /> : null}
            </dt>
            <dd className="mt-2 flex flex-wrap gap-1.5">
              {props.serviceTypes.length > 0 ? (
                props.serviceTypes.map((item) => (
                  <Badge key={item} variant="outline">
                    {SERVICE_TYPE_LABELS[item]}
                  </Badge>
                ))
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </dd>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <dt className="eyebrow">Líder do projeto</dt>
            <dd className="mt-2">
              <InlineOwnerSelect projectId={projectId} value={props.ownerId} members={props.memberOptions} disabled={!canManage} />
            </dd>
          </div>
          <div className="rounded-lg border border-border bg-card p-4 sm:col-span-2">
            <dt className="flex items-center justify-between">
              <span className="eyebrow">Responsáveis</span>
              {canManage ? <MembersEditDialog projectId={projectId} memberIds={props.memberIds} members={props.memberOptions} /> : null}
            </dt>
            <dd className="mt-2 flex flex-wrap gap-2">
              {props.memberProfiles.length > 0 ? (
                props.memberProfiles.map((member) => (
                  <span key={member.id} className="flex items-center gap-1.5 rounded-full border border-border-strong py-0.5 pl-0.5 pr-2.5 text-[13px] font-semibold">
                    <UserAvatar name={member.full_name} src={member.avatar_url} profileId={member.id} className="size-6" />
                    {member.full_name}
                  </span>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">Ninguém além do líder.</span>
              )}
            </dd>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <dt className="eyebrow">{props.model === "recorrente" ? "Início do projeto" : "Data inicial"}</dt>
            <dd className="mt-2">
              <InlineDate value={props.startDate} disabled={!canManage} onSave={(value) => save({ startDate: value })} aria-label="Data inicial" />
            </dd>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <dt className="eyebrow">{props.model === "recorrente" ? "Fim do projeto" : "Data de entrega"}</dt>
            <dd className="mt-2">
              <InlineDate
                value={props.model === "recorrente" ? props.endDate : props.dueDate}
                disabled={!canManage}
                onSave={(value) => save(props.model === "recorrente" ? { endDate: value } : { dueDate: value })}
                aria-label={props.model === "recorrente" ? "Fim do projeto" : "Data de entrega"}
              />
              {props.model === "recorrente" && !props.endDate ? (
                <p className="mt-1 text-[12px] text-subtle">Em andamento{props.startDate ? ` desde ${formatDate(props.startDate)}` : ""}.</p>
              ) : null}
            </dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="briefing-title" className="space-y-3">
        <h2 id="briefing-title" className="section-title">
          Briefing
        </h2>
        <div className="rounded-lg border border-border bg-card p-4">
          <InlineEditable
            value={props.briefing ?? ""}
            multiline
            disabled={!canManage}
            placeholder="Sem briefing ainda. Clique para escrever."
            aria-label="Briefing do projeto"
            onSave={(value) => save({ briefing: value || null })}
          />
        </div>
      </section>

      <section aria-labelledby="producao-title" className="space-y-3">
        <h2 id="producao-title" className="section-title">
          Produção
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="eyebrow mb-2">Informações da captação</p>
            <InlineEditable
              value={props.productionNotes ?? ""}
              multiline
              disabled={!canManage}
              placeholder="Clique para adicionar."
              aria-label="Informações de produção"
              onSave={(value) => save({ productionNotes: value || null })}
            />
          </div>
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="eyebrow mb-2">Endereço do local</p>
              <InlineEditable
                value={props.locationAddress ?? ""}
                disabled={!canManage}
                placeholder="Clique para adicionar."
                aria-label="Endereço do local"
                onSave={(value) => save({ locationAddress: value || null })}
              />
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="eyebrow mb-2">Notas do local</p>
              <InlineEditable
                value={props.locationNotes ?? ""}
                multiline
                disabled={!canManage}
                placeholder="Estacionamento, acesso, contato no local…"
                aria-label="Notas do local"
                onSave={(value) => save({ locationNotes: value || null })}
              />
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="entrega-title" className="space-y-3">
        <h2 id="entrega-title" className="section-title">
          Entrega
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="eyebrow mb-2">Rodadas de alteração incluídas</p>
            <InlineEditable
              value={props.includedRevisionRounds != null ? String(props.includedRevisionRounds) : ""}
              disabled={!canManage}
              placeholder="Ex.: 2"
              aria-label="Rodadas de alteração incluídas"
              onSave={(value) => {
                const parsed = value === "" ? null : Number(value);
                if (parsed !== null && (!Number.isInteger(parsed) || parsed < 0 || parsed > 99)) {
                  return Promise.resolve({ ok: false, error: "Informe um número de 0 a 99." } satisfies ActionResult);
                }
                return save({ includedRevisionRounds: parsed });
              }}
            />
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="eyebrow mb-2">Pasta do Drive</p>
            <InlineEditable
              value={props.driveFolderUrl ?? ""}
              disabled={!canManage}
              placeholder="https://drive.google.com/…"
              aria-label="Pasta do Drive"
              onSave={(value) => save({ driveFolderUrl: value || null })}
            />
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="eyebrow mb-2">Notas de entrega</p>
          <InlineEditable
            value={props.deliveryNotes ?? ""}
            multiline
            disabled={!canManage}
            placeholder="Formato final, prazo combinado, observações…"
            aria-label="Notas de entrega"
            onSave={(value) => save({ deliveryNotes: value || null })}
          />
        </div>
      </section>
    </div>
  );
}
