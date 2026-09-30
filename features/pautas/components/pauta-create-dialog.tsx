"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FolderPlus, ListTodo, Plus, Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { createQuickProjectAction } from "@/app/(app)/projetos/actions";
import { ClientAvatar } from "@/components/companies/client-avatar";
import { OwnerSelect } from "@/components/projects/owner-select";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchSelect, type SearchSelectOption } from "@/components/ui/search-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusDot } from "@/components/ui/status-dot";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { createStandaloneTaskAction } from "@/features/minhas-pautas/actions";
import { createPautaAction, getPautaDetailAction } from "@/features/pautas/actions";
import type { PautaFormOptions, PautaOptionProject } from "@/features/pautas/types";
import { FUNCTION_LABELS, PAUTA_ACTIVITIES_BY_SQUAD, defaultActivityFor } from "@/lib/auth/roles";
import { SQUADS, SQUAD_LABELS } from "@/lib/auth/squads";
import { INTERNAL_PROJECT_LABEL, PRIORITIES, PRIORITY_LABELS } from "@/lib/domain";
import { SQUAD_TONE } from "@/lib/status";
import { cn } from "@/lib/utils";
import {
  createPautaSchema,
  createStandaloneTaskSchema,
  type CreatePautaValues,
  type CreateStandaloneTaskValues,
} from "@/lib/validations/pauta";
import type { PautaColumn, PautaWithDetails, Squad } from "@/types";

type Kind = "time" | "interna";

/** Seletor de cliente: trabalho sem empresa (projetos internos ou tarefa interna da equipe). */
const NO_CLIENT = "__sem_cliente__";
const NO_PROJECT = "__sem_projeto__";
const NO_CONTACT = "none";
const NO_FREELANCER = "__sem_freelancer__";
const SAME_AS_LEAD = "__o_lider__";

export interface PautaCreateDialogProps {
  options: PautaFormOptions;
  currentUser: { id: string; squads: Squad[] };
  /** can_manage_pautas(): master, diretoria e heads. Sem isso, só "Tarefa interna". */
  canCreateProjectPauta: boolean;
  /** Atalho "Criar projeto" (capability manageProjects). */
  canCreateProjects: boolean;
  /** Aba Pautas do projeto: cliente e projeto já definidos. */
  lockedProjectId?: string;
  /** Coluna do "+" clicado no quadro — define o status inicial. */
  defaultColumn?: PautaColumn;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onCreated?: (pauta: PautaWithDetails) => void;
  trigger?: ReactNode;
}

/**
 * Único diálogo de criação — /pautas, /minhas-pautas e aba Pautas do projeto.
 * "Pauta para o time": squad → cliente (opcional) → projeto (opcional) → líder (revisa), responsável
 * (executa) e a atividade dele, que muda conforme o squad (comercial: ajuste no CRM, prospecção…).
 * Audiovisual usa data de captação; os outros squads, data de início e prazo com hora.
 * "Tarefa interna": só para a própria pessoa. Quem não gerencia pautas só vê a tarefa interna — a
 * policy pautas_insert repete a regra no banco.
 */
export function PautaCreateDialog(props: PautaCreateDialogProps) {
  const { canCreateProjectPauta, lockedProjectId } = props;
  const [internalOpen, setInternalOpen] = useState(false);
  const controlled = props.open !== undefined;
  const open = controlled ? props.open === true : internalOpen;
  const initialKind: Kind = canCreateProjectPauta ? "time" : "interna";
  const [kind, setKind] = useState<Kind>(initialKind);

  function setOpen(next: boolean) {
    if (next) setKind(initialKind);
    if (controlled) props.onOpenChange?.(next);
    else setInternalOpen(next);
  }

  const showChooser = canCreateProjectPauta && !lockedProjectId;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {controlled ? null : (
        <DialogTrigger asChild>
          {props.trigger ?? (
            <Button>
              <Plus aria-hidden />
              Nova pauta
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nova pauta.</DialogTitle>
          <DialogDescription>
            {kind === "time"
              ? "Pauta ou tarefa para alguém do time — com ou sem cliente e projeto."
              : "Tarefa interna: sua, sem cliente nem projeto."}
          </DialogDescription>
        </DialogHeader>

        {showChooser ? (
          <div role="radiogroup" aria-label="Tipo" className="grid gap-2 sm:grid-cols-2">
            {(
              [
                { value: "time", label: "Pauta para o time", hint: "Escolha squad, líder, responsável e o que ele vai fazer.", icon: Users },
                { value: "interna", label: "Tarefa interna", hint: "Só para você, sem cliente nem projeto.", icon: ListTodo },
              ] as const
            ).map((option) => {
              const Icon = option.icon;
              const active = kind === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setKind(option.value)}
                  className={cn(
                    "flex items-start gap-3 rounded-md border p-3 text-left transition-colors",
                    active ? "border-brand-accent/60 bg-surface-hover" : "border-border hover:border-border-strong",
                  )}
                >
                  <Icon className={cn("mt-0.5 size-4 shrink-0", active ? "text-brand-accent" : "text-subtle")} aria-hidden />
                  <span>
                    <span className="block text-sm font-bold">{option.label}</span>
                    <span className="block text-[12px] text-muted-foreground">{option.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}

        {kind === "time" ? (
          <TeamPautaForm {...props} onDone={() => setOpen(false)} />
        ) : (
          <InternalTaskForm squads={props.currentUser.squads} onDone={() => setOpen(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Pauta para o time
// ---------------------------------------------------------------------------

function initialSquad(squads: Squad[]): Squad {
  if (squads.includes("audiovisual")) return "audiovisual";
  return squads.find((squad) => squad !== "diretoria") ?? squads[0] ?? "audiovisual";
}

function emptyValues(props: PautaCreateDialogProps, squad: Squad): CreatePautaValues {
  return {
    projectId: props.lockedProjectId ?? "",
    companyId: "",
    executorId: "",
    executorActivity: defaultActivityFor(squad),
    dueTime: "",
    squad,
    members: [],
    freelancerId: "",
    title: "",
    briefing: "",
    leadId: props.currentUser.id,
    boardColumn: props.defaultColumn ?? "",
    priority: "media",
    isCritical: false,
    captureType: [],
    format: "",
    locationAddress: "",
    scheduledDate: "",
    scheduledTime: "",
    durationMinutes: "",
    startDate: "",
    dueDate: "",
    contactId: "",
    contactPhoneOverride: "",
    driveFolderUrl: "",
    scriptUrl: "",
    equipmentNotes: "",
  };
}

function clientKeyOf(project: PautaOptionProject | undefined): string {
  if (!project) return "";
  return project.is_internal || !project.company_id ? NO_CLIENT : project.company_id;
}

function TeamPautaForm(props: PautaCreateDialogProps & { onDone: () => void }) {
  const { options, lockedProjectId, canCreateProjects, onCreated, onDone } = props;
  const router = useRouter();
  const [projects, setProjects] = useState<PautaOptionProject[]>(options.projects);
  const lockedProject = lockedProjectId ? projects.find((project) => project.id === lockedProjectId) : undefined;
  const [clientKey, setClientKey] = useState<string>(lockedProject ? clientKeyOf(lockedProject) : "");
  const [newProjectName, setNewProjectName] = useState("");
  const [showNewProject, setShowNewProject] = useState(false);
  const [creatingProject, startCreatingProject] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const startSquad = initialSquad(props.currentUser.squads);
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreatePautaValues>({ resolver: zodResolver(createPautaSchema), defaultValues: emptyValues(props, startSquad) });
  const members = useFieldArray({ control, name: "members" });
  const projectId = watch("projectId");
  const squadValue = watch("squad");
  const squad: Squad = squadValue || startSquad;
  const activities = PAUTA_ACTIVITIES_BY_SQUAD[squad];
  const isProduction = squad === "audiovisual";

  const clientOptions: SearchSelectOption[] = [
    { value: NO_CLIENT, label: "Sem cliente — interno da Além", leading: <ClientAvatar name="Além Filmes" size="sm" /> },
    ...options.companies.map((company) => ({
      value: company.id,
      label: company.name,
      leading: <ClientAvatar name={company.name} logoUrl={company.logo_url} size="sm" />,
    })),
  ];
  const clientProjects = clientKey
    ? projects.filter((project) => (clientKey === NO_CLIENT ? project.is_internal || !project.company_id : project.company_id === clientKey))
    : [];
  const selectedProject = projects.find((project) => project.id === projectId);
  const pautaCompanyId = selectedProject?.company_id ?? (clientKey && clientKey !== NO_CLIENT ? clientKey : null);
  const contacts = pautaCompanyId ? options.contacts.filter((contact) => contact.company_id === pautaCompanyId) : [];

  function chooseSquad(next: Squad) {
    setValue("squad", next);
    // A atividade do responsável (e dos extras) precisa existir no squad novo.
    const allowed = PAUTA_ACTIVITIES_BY_SQUAD[next];
    setValue("executorActivity", allowed[0] ?? "outro");
    members.fields.forEach((field, index) => {
      if (!allowed.includes(field.productionFunction)) setValue(`members.${index}.productionFunction`, allowed[0] ?? "outro");
    });
  }

  function chooseClient(next: string) {
    setClientKey(next);
    setValue("companyId", next && next !== NO_CLIENT ? next : "");
    setValue("projectId", "");
    setValue("contactId", "");
    setNewProjectName("");
    setShowNewProject(false);
  }

  function createProject() {
    const name = newProjectName.trim();
    if (!name) return;
    startCreatingProject(async () => {
      const result = await createQuickProjectAction({ name, companyId: clientKey && clientKey !== NO_CLIENT ? clientKey : null });
      if (!result.ok || !result.project) {
        toast.error(result.ok ? "Não foi possível criar o projeto." : result.error);
        return;
      }
      const created = result.project;
      setProjects((current) => [...current, created]);
      setValue("projectId", created.id, { shouldValidate: true });
      setNewProjectName("");
      setShowNewProject(false);
      toast.success(`Projeto "${created.name}" criado.`);
    });
  }

  const onSubmit = handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const result = await createPautaAction({ ...values, squad });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(result.message);
      onDone();
      if (result.id && onCreated) {
        const detail = await getPautaDetailAction(result.id);
        if (detail) onCreated(detail.pauta);
      } else {
        router.refresh();
      }
    });
  });

  const activitySelect = (value: CreatePautaValues["executorActivity"], onChange: (value: CreatePautaValues["executorActivity"]) => void, label: string) => (
    <Select value={value} onValueChange={(next) => onChange(next as CreatePautaValues["executorActivity"])}>
      <SelectTrigger aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {activities.map((item) => (
          <SelectItem key={item} value={item}>
            {FUNCTION_LABELS[item]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {error ? <Alert variant="error">{error}</Alert> : null}

      <FormField id="pauta-squad" label="Squad" hint="Define as atividades do responsável e quais datas a pauta usa.">
        <Select value={squad} onValueChange={(value) => chooseSquad(value as Squad)}>
          <SelectTrigger id="pauta-squad">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SQUADS.map((item) => (
              <SelectItem key={item} value={item}>
                <span className="flex items-center gap-2">
                  <StatusDot tone={SQUAD_TONE[item]} />
                  {SQUAD_LABELS[item]}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>

      {lockedProject ? (
        <p className="flex items-center gap-2 rounded-md border border-border bg-surface-raised px-3 py-2 text-sm">
          <span className="text-subtle">Projeto:</span>
          <span className="font-semibold">{lockedProject.name}</span>
        </p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField id="pauta-client" label="Cliente" hint="Opcional. Serve também para prospects sem projeto.">
            <SearchSelect
              id="pauta-client"
              value={clientKey}
              onChange={chooseClient}
              options={clientOptions}
              placeholder="Sem cliente"
              emptyLabel="Nenhum cliente com esse nome."
            />
          </FormField>
          <FormField id="pauta-project" label="Projeto" hint="Opcional." error={errors.projectId?.message}>
            <Controller
              control={control}
              name="projectId"
              render={({ field }) => (
                <Select
                  value={field.value || NO_PROJECT}
                  onValueChange={(value) => field.onChange(value === NO_PROJECT ? "" : value)}
                  disabled={!clientKey}
                >
                  <SelectTrigger id="pauta-project">
                    <SelectValue placeholder={clientKey ? "Sem projeto" : "Escolha o cliente antes"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_PROJECT}>Sem projeto</SelectItem>
                    {clientProjects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
          {clientKey && canCreateProjects ? (
            <div className="sm:col-span-2">
              {showNewProject ? (
                <div className="flex flex-wrap gap-2 rounded-md border border-dashed border-border-strong p-3">
                  <Input
                    aria-label="Nome do novo projeto"
                    placeholder={clientKey === NO_CLIENT ? `Nome do projeto (${INTERNAL_PROJECT_LABEL})` : "Nome do projeto"}
                    className="h-9 min-w-0 flex-1"
                    value={newProjectName}
                    onChange={(event) => setNewProjectName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        createProject();
                      }
                    }}
                  />
                  <Button type="button" size="sm" variant="secondary" loading={creatingProject} disabled={newProjectName.trim().length < 2} onClick={createProject}>
                    <FolderPlus aria-hidden />
                    Criar projeto
                  </Button>
                </div>
              ) : (
                <button type="button" onClick={() => setShowNewProject(true)} className="text-[13px] font-semibold text-muted-foreground underline underline-offset-4 hover:text-foreground">
                  + Criar um projeto para este cliente
                </button>
              )}
            </div>
          ) : null}
        </div>
      )}

      <FormField id="pauta-title" label="Título" error={errors.title?.message}>
        <Input id="pauta-title" aria-invalid={!!errors.title} {...register("title")} />
      </FormField>

      <FormField id="pauta-briefing" label="Briefing / o que precisa ser feito" hint="Opcional." error={errors.briefing?.message}>
        <Textarea id="pauta-briefing" {...register("briefing")} />
      </FormField>

      <div className="grid gap-5 sm:grid-cols-3">
        <FormField id="pauta-lead" label="Líder (revisa)" error={errors.leadId?.message}>
          <Controller
            control={control}
            name="leadId"
            render={({ field }) => <OwnerSelect id="pauta-lead" value={field.value} onChange={field.onChange} members={options.members} invalid={!!errors.leadId} />}
          />
        </FormField>
        <FormField id="pauta-executor" label="Responsável (executa)">
          <Controller
            control={control}
            name="executorId"
            render={({ field }) => (
              <Select value={field.value || SAME_AS_LEAD} onValueChange={(value) => field.onChange(value === SAME_AS_LEAD ? "" : value)}>
                <SelectTrigger id="pauta-executor">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SAME_AS_LEAD}>O próprio líder</SelectItem>
                  {options.members.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>
        <FormField id="pauta-activity" label="O que vai fazer">
          <Controller control={control} name="executorActivity" render={({ field }) => activitySelect(field.value, field.onChange, "Atividade do responsável")} />
        </FormField>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <FormField id="pauta-priority" label="Prioridade">
          <Controller
            control={control}
            name="priority"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="pauta-priority">
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
        {isProduction ? (
          <>
            <FormField id="pauta-scheduled-date" label="Data da captação" hint="Opcional." error={errors.scheduledDate?.message}>
              <Input id="pauta-scheduled-date" type="date" {...register("scheduledDate")} />
            </FormField>
            <FormField id="pauta-scheduled-time" label="Horário da captação" error={errors.scheduledTime?.message}>
              <Input id="pauta-scheduled-time" type="time" {...register("scheduledTime")} />
            </FormField>
          </>
        ) : (
          <FormField id="pauta-start" label="Início" hint="Opcional." error={errors.startDate?.message}>
            <Input id="pauta-start" type="date" {...register("startDate")} />
          </FormField>
        )}
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <FormField id="pauta-due" label="Prazo de entrega" error={errors.dueDate?.message}>
          <Input id="pauta-due" type="date" {...register("dueDate")} />
        </FormField>
        <FormField id="pauta-due-time" label="Até que horas" hint="Opcional." error={errors.dueTime?.message}>
          <Input id="pauta-due-time" type="time" {...register("dueTime")} />
        </FormField>
        {isProduction ? (
          <FormField id="pauta-location" label="Local" hint="Opcional." error={errors.locationAddress?.message}>
            <Input id="pauta-location" {...register("locationAddress")} />
          </FormField>
        ) : null}
      </div>

      {pautaCompanyId ? (
        <FormField id="pauta-contact" label="Contato do cliente" hint="Opcional. Pessoas da equipe do cliente, cadastradas na página dele.">
          <Controller
            control={control}
            name="contactId"
            render={({ field }) => (
              <Select value={field.value || NO_CONTACT} onValueChange={(value) => field.onChange(value === NO_CONTACT ? "" : value)}>
                <SelectTrigger id="pauta-contact">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CONTACT}>Sem contato definido</SelectItem>
                  {contacts.map((contact) => (
                    <SelectItem key={contact.id} value={contact.id}>
                      {contact.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>
      ) : null}

      <fieldset className="space-y-2">
        <legend className="mb-1 flex w-full items-center justify-between gap-2 text-sm font-semibold">
          Mais responsáveis
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => members.append({ profileId: "", productionFunction: activities[0] ?? "outro" })}
            disabled={members.fields.length >= 20}
          >
            <UserPlus aria-hidden />
            Adicionar
          </Button>
        </legend>
        {members.fields.length === 0 ? (
          <p className="text-[13px] text-subtle">Opcional: outras pessoas do time que também atuam nesta pauta.</p>
        ) : (
          <ul className="space-y-2">
            {members.fields.map((field, index) => (
              <li key={field.id} className="grid grid-cols-[minmax(0,1fr)_11rem_auto] items-center gap-2">
                <Controller
                  control={control}
                  name={`members.${index}.profileId`}
                  render={({ field: person }) => (
                    <OwnerSelect
                      id={`pauta-member-${index}`}
                      value={person.value}
                      onChange={person.onChange}
                      members={options.members}
                      invalid={!!errors.members?.[index]?.profileId}
                    />
                  )}
                />
                <Controller
                  control={control}
                  name={`members.${index}.productionFunction`}
                  render={({ field: fn }) => activitySelect(fn.value, fn.onChange, "Atividade")}
                />
                <Button type="button" variant="ghost" size="icon" className="size-9" aria-label="Remover responsável" onClick={() => members.remove(index)}>
                  <Trash2 aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
        {errors.members ? <p className="text-[13px] font-semibold">Escolha a pessoa de cada responsável.</p> : null}
      </fieldset>

      {options.freelancers.length > 0 ? (
        <FormField
          id="pauta-freelancer"
          label="Freelancer (opcional)"
          hint="Só sinaliza com quem está a execução. O líder e o responsável continuam cobrando a entrega."
        >
          <Controller
            control={control}
            name="freelancerId"
            render={({ field }) => (
              <Select value={field.value || NO_FREELANCER} onValueChange={(value) => field.onChange(value === NO_FREELANCER ? "" : value)}>
                <SelectTrigger id="pauta-freelancer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_FREELANCER}>Sem freelancer</SelectItem>
                  {options.freelancers.map((freelancer) => (
                    <SelectItem key={freelancer.id} value={freelancer.id}>
                      {freelancer.full_name}
                      {freelancer.functions.length ? ` · ${freelancer.functions.map((fn) => FUNCTION_LABELS[fn]).join(", ")}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>
      ) : null}

      <div className="flex items-center justify-between gap-4 rounded-md border border-border px-3 py-3">
        <Label htmlFor="pauta-critical" className="cursor-pointer">
          Pauta crítica
        </Label>
        <Controller control={control} name="isCritical" render={({ field }) => <Switch id="pauta-critical" checked={field.value} onCheckedChange={field.onChange} />} />
      </div>

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="secondary">
            Cancelar
          </Button>
        </DialogClose>
        <Button type="submit" loading={pending}>
          Criar pauta
        </Button>
      </DialogFooter>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Tarefa interna
// ---------------------------------------------------------------------------

function InternalTaskForm({ squads, onDone }: { squads: Squad[]; onDone: () => void }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateStandaloneTaskValues>({
    resolver: zodResolver(createStandaloneTaskSchema),
    defaultValues: { title: "", description: "", dueDate: "", priority: "media", squad: squads.length > 1 ? (squads[0] ?? "") : "" },
  });

  const onSubmit = handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const result = await createStandaloneTaskAction(values);
      if (!result.ok) return setError(result.error);
      toast.success(result.message);
      onDone();
      router.refresh();
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {error ? <Alert variant="error">{error}</Alert> : null}
      <FormField id="task-title" label="Título" error={errors.title?.message}>
        <Input id="task-title" aria-invalid={!!errors.title} {...register("title")} />
      </FormField>
      <FormField id="task-description" label="Descrição" hint="Opcional." error={errors.description?.message}>
        <Textarea id="task-description" {...register("description")} />
      </FormField>
      <div className={cn("grid gap-5", squads.length > 1 ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
        <FormField id="task-due" label="Prazo" error={errors.dueDate?.message}>
          <Input id="task-due" type="date" {...register("dueDate")} />
        </FormField>
        <FormField id="task-priority" label="Prioridade">
          <Controller
            control={control}
            name="priority"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="task-priority">
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
        {squads.length > 1 ? (
          <FormField id="task-squad" label="Squad">
            <Controller
              control={control}
              name="squad"
              render={({ field }) => (
                <Select value={field.value || undefined} onValueChange={field.onChange}>
                  <SelectTrigger id="task-squad">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {squads.map((squad) => (
                      <SelectItem key={squad} value={squad}>
                        <span className="flex items-center gap-2">
                          <StatusDot tone={SQUAD_TONE[squad]} />
                          {SQUAD_LABELS[squad]}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
        ) : null}
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="secondary">
            Cancelar
          </Button>
        </DialogClose>
        <Button type="submit" loading={pending}>
          Criar tarefa
        </Button>
      </DialogFooter>
    </form>
  );
}
