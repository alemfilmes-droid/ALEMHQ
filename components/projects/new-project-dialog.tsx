"use client";

import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { createProjectAction } from "@/app/(app)/projetos/actions";
import { MemberPicker } from "@/components/projects/member-picker";
import { MarginPreview } from "@/components/projects/margin-preview";
import { OwnerSelect } from "@/components/projects/owner-select";
import { ProjectCostsField } from "@/components/projects/project-costs-field";
import { ServiceTypePicker } from "@/components/projects/service-type-picker";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { MODEL_LABELS, MODELS, PRIORITIES, PRIORITY_LABELS, PROJECT_STAGES, STAGE_LABELS } from "@/lib/domain";
import { projectSchema, type ProjectValues } from "@/lib/validations/project";

interface NewProjectDialogProps {
  companies: { id: string; name: string }[];
  contacts: { id: string; company_id: string; full_name: string }[];
  members: { id: string; full_name: string; avatar_url: string | null }[];
  /** Campos financeiros só existem para quem tem acesso ao financeiro. */
  showFinance: boolean;
  defaultOwnerId: string;
}

const EMPTY = (ownerId: string): ProjectValues => ({
  name: "",
  isInternal: false,
  companyId: "",
  contactId: "",
  briefing: "",
  serviceTypes: [],
  priority: "media",
  stage: "planejamento",
  model: "transacional",
  dueDate: "",
  startDate: "",
  endDate: "",
  ownerId,
  memberIds: [],
  driveFolderUrl: "",
  includedRevisionRounds: "",
  contractValue: "",
  paymentTerms: "",
  costs: [],
});

const NO_CONTACT = "none";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="eyebrow border-t border-border pt-5">{children}</p>;
}

export function NewProjectDialog({ companies, contacts, members, showFinance, defaultOwnerId }: NewProjectDialogProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ProjectValues>({ resolver: zodResolver(projectSchema), defaultValues: EMPTY(defaultOwnerId) });
  const isInternal = watch("isInternal");
  const companyId = watch("companyId");
  const model = watch("model");
  const contractValue = watch("contractValue");
  const costs = watch("costs");
  const companyContacts = contacts.filter((contact) => contact.company_id === companyId);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      reset(EMPTY(defaultOwnerId));
      setError(null);
    }
  }

  const onSubmit = handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const result = await createProjectAction(values);
      if (result && !result.ok) setError(result.error);
    });
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus aria-hidden />
          Novo projeto
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Novo projeto.</DialogTitle>
          <DialogDescription>Projetos internos não têm cliente.</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="space-y-5">
          {error ? <Alert variant="error">{error}</Alert> : null}

          <p className="eyebrow">Cliente</p>
          <div className="flex items-center justify-between gap-4 rounded-md border border-border px-3 py-3">
            <Label htmlFor="project-internal" className="cursor-pointer">
              Projeto interno
            </Label>
            <Controller
              control={control}
              name="isInternal"
              render={({ field }) => (
                <Switch
                  id="project-internal"
                  checked={field.value}
                  onCheckedChange={(checked) => {
                    field.onChange(checked);
                    if (checked) {
                      setValue("companyId", "");
                      setValue("contactId", "");
                    }
                  }}
                />
              )}
            />
          </div>

          {isInternal ? null : (
            <>
              <FormField id="project-company" label="Cliente" error={errors.companyId?.message}>
                <Controller
                  control={control}
                  name="companyId"
                  render={({ field }) => (
                    <Select
                      value={field.value || undefined}
                      onValueChange={(value) => {
                        field.onChange(value);
                        setValue("contactId", "");
                      }}
                    >
                      <SelectTrigger id="project-company" aria-invalid={!!errors.companyId}>
                        <SelectValue placeholder="Selecione o cliente" />
                      </SelectTrigger>
                      <SelectContent>
                        {companies.map((company) => (
                          <SelectItem key={company.id} value={company.id}>
                            {company.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormField>

              <FormField id="project-contact" label="Contato">
                <Controller
                  control={control}
                  name="contactId"
                  render={({ field }) => (
                    <Select
                      value={field.value || NO_CONTACT}
                      onValueChange={(value) => field.onChange(value === NO_CONTACT ? "" : value)}
                      disabled={!companyId}
                    >
                      <SelectTrigger id="project-contact">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_CONTACT}>Sem contato definido</SelectItem>
                        {companyContacts.map((contact) => (
                          <SelectItem key={contact.id} value={contact.id}>
                            {contact.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormField>
            </>
          )}

          <SectionTitle>Projeto</SectionTitle>

          <FormField id="project-name" label="Nome do projeto" error={errors.name?.message}>
            <Input id="project-name" aria-invalid={!!errors.name} aria-describedby={errors.name ? "project-name-message" : undefined} {...register("name")} />
          </FormField>

          <FormField id="project-briefing" label="Briefing" hint="Opcional." error={errors.briefing?.message}>
            <Textarea id="project-briefing" {...register("briefing")} />
          </FormField>

          <Controller
            control={control}
            name="serviceTypes"
            render={({ field }) => <ServiceTypePicker idPrefix="svc" value={field.value} onChange={field.onChange} />}
          />

          <div className="grid gap-5 sm:grid-cols-2">
            <FormField id="project-priority" label="Prioridade">
              <Controller
                control={control}
                name="priority"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="project-priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map((item) => (
                        <SelectItem key={item} value={item}>
                          {PRIORITY_LABELS[item]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
            <FormField id="project-stage" label="Etapa inicial">
              <Controller
                control={control}
                name="stage"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="project-stage">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROJECT_STAGES.map((stage) => (
                        <SelectItem key={stage} value={stage}>
                          {STAGE_LABELS[stage]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
          </div>

          <FormField id="project-model" label="Modelo comercial">
            <Controller
              control={control}
              name="model"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(value) => {
                    field.onChange(value);
                    setValue("dueDate", "");
                    setValue("startDate", "");
                    setValue("endDate", "");
                  }}
                >
                  <SelectTrigger id="project-model">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODELS.map((item) => (
                      <SelectItem key={item} value={item}>
                        {MODEL_LABELS[item]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>

          {model === "transacional" ? (
            <FormField id="project-due" label="Data de entrega" error={errors.dueDate?.message}>
              <Input id="project-due" type="date" {...register("dueDate")} />
            </FormField>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField id="project-start" label="Início do projeto" error={errors.startDate?.message}>
                <Input id="project-start" type="date" {...register("startDate")} />
              </FormField>
              <FormField id="project-end" label="Fim do projeto" hint="Deixe em branco se está em andamento." error={errors.endDate?.message}>
                <Input id="project-end" type="date" {...register("endDate")} />
              </FormField>
            </div>
          )}

          <SectionTitle>Equipe</SectionTitle>

          <FormField id="project-owner" label="Responsável pelo projeto" error={errors.ownerId?.message}>
            <Controller
              control={control}
              name="ownerId"
              render={({ field }) => <OwnerSelect id="project-owner" value={field.value} onChange={field.onChange} members={members} invalid={!!errors.ownerId} />}
            />
          </FormField>

          <FormField id="project-members" label="Membros" hint="Além do responsável, que já participa.">
            <Controller
              control={control}
              name="memberIds"
              render={({ field }) => <MemberPicker idPrefix="member" value={field.value} onChange={field.onChange} members={members} />}
            />
          </FormField>

          <SectionTitle>Entrega</SectionTitle>

          <FormField id="project-drive" label="Link da pasta do Drive" hint="Opcional." error={errors.driveFolderUrl?.message}>
            <Input id="project-drive" placeholder="https://drive.google.com/…" {...register("driveFolderUrl")} />
          </FormField>
          <FormField id="project-revisions" label="Rodadas de revisão incluídas" hint="Opcional." error={errors.includedRevisionRounds?.message}>
            <Input id="project-revisions" inputMode="numeric" className="max-w-24" {...register("includedRevisionRounds")} />
          </FormField>

          {showFinance ? (
            <>
              <SectionTitle>Financeiro</SectionTitle>
              <FormField id="project-value" label="Valor do contrato (R$)" error={errors.contractValue?.message}>
                <Input id="project-value" inputMode="decimal" placeholder="0,00" {...register("contractValue")} />
              </FormField>
              <FormField id="project-terms" label="Condições de pagamento" error={errors.paymentTerms?.message}>
                <Textarea id="project-terms" {...register("paymentTerms")} />
              </FormField>
              <ProjectCostsField control={control} register={register} errors={errors} />
              <MarginPreview contractValue={contractValue} costAmounts={costs.map((cost) => cost.amount)} />
            </>
          ) : null}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" loading={pending}>
              Criar projeto
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
