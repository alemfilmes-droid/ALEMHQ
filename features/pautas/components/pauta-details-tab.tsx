"use client";

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { ArrowRightCircle, Check, CheckCircle2, Clapperboard, ExternalLink, FileText, FolderOpen, MapPin, Package, Pencil, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { updatePautaAction } from "@/features/pautas/actions";
import { HandoverDialog } from "@/features/pautas/components/handover-dialog";
import { PautaStatusBadge } from "@/features/pautas/components/pauta-status-badge";
import type { PautaDetail, PautaFormOptions } from "@/features/pautas/types";
import { OwnerSelect } from "@/components/projects/owner-select";
import { UserAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SquadBadge } from "@/components/ui/squad-badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { FUNCTION_LABELS } from "@/lib/auth/roles";
import { appZoneToIso, dateInAppZone, timeInAppZone } from "@/lib/calendar";
import { INTERNAL_PROJECT_LABEL, PRIORITIES, PRIORITY_LABELS } from "@/lib/domain";
import { formatDate, formatDateTime } from "@/lib/format";
import { PAUTA_CAPTURE_TYPES, PAUTA_CAPTURE_TYPE_LABELS } from "@/lib/pautas";
import type { PautaCaptureType, PautaStatus, PautaWithDetails, ProjectPriority } from "@/types";
import { InvoiceTaskCallout } from "@/features/finance/components/invoice-controls";
import { isInvoiceTaskTitle } from "@/lib/links";

const NO_FREELANCER = "__sem_freelancer__";
const NO_WAITING = "__ninguem__";

interface PautaDetailsTabProps {
  detail: PautaDetail;
  options: PautaFormOptions;
  /** Gestão plena (master/diretoria/head de audiovisual). */
  canManage: boolean;
  /** Quem está na pauta (líder, responsável, membros) ou a gestão: status e campos de andamento. */
  canEditOperationally: boolean;
  /** Quem criou a pauta ou a gestão do squad: o lápis abre a edição de todos os dados. */
  canEditAll: boolean;
  /** Quem criou a pauta: só essa pessoa aprova (o banco repete a regra). */
  canApprove: boolean;
  onChanged: (pauta: PautaWithDetails) => void;
}

// ---------------------------------------------------------------------------
// Blocos de leitura
// ---------------------------------------------------------------------------

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="eyebrow">{title}</h3>
      {children}
    </section>
  );
}

function Item({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-[12px] font-semibold text-subtle">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-foreground">{children}</dd>
    </div>
  );
}

function isUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

/**
 * Link de material (roteiro, pasta do Drive, material/entrega): na leitura, um botão que abre o
 * documento; quem está na pauta troca o link pelo lápis ao lado.
 */
function MaterialLink({
  label,
  icon: Icon,
  url,
  canEdit,
  onSave,
}: {
  label: string;
  icon: typeof FileText;
  url: string | null;
  canEdit: boolean;
  onSave: (next: string | null) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(url ?? "");
  const [pending, startTransition] = useTransition();
  const invalid = value.trim() !== "" && !isUrl(value.trim());

  function save() {
    if (invalid) return;
    startTransition(async () => {
      const ok = await onSave(value.trim() || null);
      if (ok) setEditing(false);
    });
  }

  return (
    <div className="rounded-md border border-border bg-surface-raised p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[12px] font-semibold text-subtle">
          <Icon className="size-3.5" aria-hidden />
          {label}
        </span>
        {canEdit && !editing ? (
          <button
            type="button"
            onClick={() => {
              setValue(url ?? "");
              setEditing(true);
            }}
            className="rounded-sm p-1 text-subtle hover:bg-surface-hover hover:text-foreground"
            aria-label={`Editar link: ${label}`}
            title="Editar link"
          >
            <Pencil className="size-3.5" aria-hidden />
          </button>
        ) : null}
      </div>
      {editing ? (
        <div className="mt-2 space-y-1.5">
          <div className="flex gap-1.5">
            <Input
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="https://drive.google.com/…"
              aria-label={label}
              aria-invalid={invalid || undefined}
              className="h-9"
              autoFocus
            />
            <Button type="button" size="icon" className="size-9 shrink-0" onClick={save} loading={pending} disabled={invalid} aria-label="Salvar link">
              {pending ? null : <Check aria-hidden />}
            </Button>
            <Button type="button" size="icon" variant="ghost" className="size-9 shrink-0" onClick={() => setEditing(false)} aria-label="Cancelar">
              <X aria-hidden />
            </Button>
          </div>
          {invalid ? <p className="text-[12px] font-semibold">Use um link começando com http:// ou https://</p> : null}
        </div>
      ) : url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1.5 inline-flex max-w-full items-center gap-1.5 text-sm font-semibold text-foreground underline underline-offset-4 hover:text-muted-foreground"
        >
          <span className="truncate">Abrir {label.toLocaleLowerCase("pt-BR")}</span>
          <ExternalLink className="size-3.5 shrink-0" aria-hidden />
        </a>
      ) : (
        <p className="mt-1.5 text-sm text-subtle">Ainda não anexado.</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Edição completa (lápis) — só quem criou ou a gestão do squad
// ---------------------------------------------------------------------------

interface EditValues {
  title: string;
  briefing: string;
  priority: ProjectPriority;
  isCritical: boolean;
  leadId: string;
  format: string;
  locationAddress: string;
  scheduledDate: string;
  scheduledTime: string;
  durationMinutes: string;
  startDate: string;
  dueDate: string;
  dueTime: string;
  contactPhoneOverride: string;
  equipmentNotes: string;
  captureType: PautaCaptureType[];
}

function toEditValues(pauta: PautaWithDetails): EditValues {
  return {
    title: pauta.title ?? "",
    briefing: pauta.briefing ?? "",
    priority: pauta.priority ?? "media",
    isCritical: pauta.is_critical ?? false,
    leadId: pauta.lead_id ?? "",
    format: pauta.format ?? "",
    locationAddress: pauta.location_address ?? "",
    // Data e hora sempre em Fortaleza (antes saíam em UTC, 3 h adiantadas).
    scheduledDate: pauta.scheduled_at ? dateInAppZone(pauta.scheduled_at) : "",
    scheduledTime: pauta.scheduled_at ? timeInAppZone(pauta.scheduled_at) : "",
    durationMinutes: pauta.duration_minutes != null ? String(pauta.duration_minutes) : "",
    startDate: pauta.start_date ?? "",
    dueDate: pauta.due_date ?? "",
    dueTime: pauta.due_time ? pauta.due_time.slice(0, 5) : "",
    contactPhoneOverride: pauta.contact_phone_override ?? "",
    equipmentNotes: pauta.equipment_notes ?? "",
    captureType: pauta.capture_type ?? [],
  };
}

function PautaEditForm({
  pauta,
  options,
  onCancel,
  onSaved,
}: {
  pauta: PautaWithDetails;
  options: PautaFormOptions;
  onCancel: () => void;
  onSaved: (pauta: PautaWithDetails) => void;
}) {
  const [pending, startTransition] = useTransition();
  const isProduction = (pauta.squad ?? "audiovisual") === "audiovisual";
  const { register, handleSubmit, watch, setValue } = useForm<EditValues>({ defaultValues: toEditValues(pauta) });
  const captureType = watch("captureType");
  const isCritical = watch("isCritical");
  const priority = watch("priority");
  const leadId = watch("leadId");

  const onSubmit = handleSubmit((values) => {
    const scheduledAt = values.scheduledDate && values.scheduledTime ? appZoneToIso(values.scheduledDate, values.scheduledTime) : null;
    const patch = {
      title: values.title,
      briefing: values.briefing || null,
      priority: values.priority,
      isCritical: values.isCritical,
      leadId: values.leadId || undefined,
      format: values.format || null,
      locationAddress: values.locationAddress || null,
      scheduledAt,
      durationMinutes: values.durationMinutes === "" ? null : Number(values.durationMinutes),
      startDate: values.startDate || null,
      dueDate: values.dueDate || null,
      dueTime: values.dueDate && values.dueTime ? values.dueTime : null,
      contactPhoneOverride: values.contactPhoneOverride || null,
      equipmentNotes: values.equipmentNotes || null,
      captureType: values.captureType,
    };
    startTransition(async () => {
      const result = await updatePautaAction(pauta.id!, patch);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Pauta atualizada.");
      const lead = options.members.find((member) => member.id === patch.leadId);
      onSaved({
        ...pauta,
        title: patch.title,
        briefing: patch.briefing,
        priority: patch.priority,
        is_critical: patch.isCritical,
        lead_id: patch.leadId ?? pauta.lead_id,
        lead_name: lead?.full_name ?? pauta.lead_name,
        lead_avatar_url: lead?.avatar_url ?? pauta.lead_avatar_url,
        format: patch.format,
        location_address: patch.locationAddress,
        scheduled_at: patch.scheduledAt,
        duration_minutes: patch.durationMinutes,
        start_date: patch.startDate,
        due_date: patch.dueDate,
        due_time: patch.dueTime,
        contact_phone_override: patch.contactPhoneOverride,
        equipment_notes: patch.equipmentNotes,
        capture_type: patch.captureType,
      });
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5 rounded-lg border border-brand-accent/30 p-4">
      <p className="flex items-center gap-2 text-sm font-bold">
        <Pencil className="size-4 text-brand-accent" aria-hidden />
        Editando a pauta
      </p>
      <FormField id="pe-title" label="Título">
        <Input id="pe-title" {...register("title", { required: true })} />
      </FormField>
      <FormField id="pe-briefing" label="Briefing">
        <Textarea id="pe-briefing" rows={6} {...register("briefing")} />
      </FormField>
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField id="pe-lead" label="Líder (revisa)">
          <OwnerSelect id="pe-lead" value={leadId} members={options.members} onChange={(value) => setValue("leadId", value)} />
        </FormField>
        <FormField id="pe-priority" label="Prioridade">
          <Select value={priority} onValueChange={(value) => setValue("priority", value as ProjectPriority)}>
            <SelectTrigger id="pe-priority">
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
        </FormField>
      </div>

      {isProduction ? (
        <div className="grid gap-5 sm:grid-cols-3">
          <FormField id="pe-scheduled-date" label="Data da captação">
            <Input id="pe-scheduled-date" type="date" {...register("scheduledDate")} />
          </FormField>
          <FormField id="pe-scheduled-time" label="Horário">
            <Input id="pe-scheduled-time" type="time" {...register("scheduledTime")} />
          </FormField>
          <FormField id="pe-duration" label="Duração (min)">
            <Input id="pe-duration" inputMode="numeric" {...register("durationMinutes")} />
          </FormField>
        </div>
      ) : null}
      <div className="grid gap-5 sm:grid-cols-3">
        <FormField id="pe-start" label="Início">
          <Input id="pe-start" type="date" {...register("startDate")} />
        </FormField>
        <FormField id="pe-due" label="Prazo de entrega">
          <Input id="pe-due" type="date" {...register("dueDate")} />
        </FormField>
        <FormField id="pe-due-time" label="Até que horas">
          <Input id="pe-due-time" type="time" {...register("dueTime")} />
        </FormField>
      </div>

      {isProduction ? (
        <>
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField id="pe-location" label="Local">
              <Input id="pe-location" {...register("locationAddress")} />
            </FormField>
            <FormField id="pe-format" label="Formato">
              <Input id="pe-format" placeholder="Vertical, horizontal…" {...register("format")} />
            </FormField>
          </div>
          <fieldset className="flex flex-wrap items-center gap-4">
            <legend className="mb-2 text-sm font-semibold">Tipo de captação</legend>
            {PAUTA_CAPTURE_TYPES.map((item) => (
              <div key={item} className="flex items-center gap-2">
                <Checkbox
                  id={`pe-capture-${item}`}
                  checked={captureType.includes(item)}
                  onCheckedChange={(checked) =>
                    setValue("captureType", checked ? [...captureType, item] : captureType.filter((value) => value !== item), { shouldDirty: true })
                  }
                />
                <Label htmlFor={`pe-capture-${item}`} className="cursor-pointer font-normal">
                  {PAUTA_CAPTURE_TYPE_LABELS[item]}
                </Label>
              </div>
            ))}
          </fieldset>
        </>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField id="pe-phone" label="Telefone do contato (substitui o cadastrado)">
          <Input id="pe-phone" {...register("contactPhoneOverride")} />
        </FormField>
        <div className="flex items-center justify-between gap-4 self-end rounded-md border border-border px-3 py-2.5">
          <Label htmlFor="pe-critical" className="cursor-pointer">
            Pauta crítica
          </Label>
          <Switch id="pe-critical" checked={isCritical} onCheckedChange={(checked) => setValue("isCritical", checked)} />
        </div>
      </div>

      <FormField id="pe-equipment" label="Equipamentos / observações de execução">
        <Textarea id="pe-equipment" {...register("equipmentNotes")} />
      </FormField>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" loading={pending}>
          Salvar pauta
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Detalhe da pauta
// ---------------------------------------------------------------------------

/**
 * Pauta "evolutiva": todos que estão nela veem uma tela de LEITURA clara (cliente, local, data e
 * hora, briefing, links clicáveis do roteiro, da pasta do Drive e do material). Quem criou — ou a
 * gestão do squad — tem o lápis para editar tudo. Quem está na pauta atualiza o andamento: status,
 * links, freelancer e "com quem está a bola" no cliente. O banco repete a regra (pautas_guard_update).
 */
export function PautaDetailsTab({ detail, options, canEditOperationally, canEditAll, canApprove, onChanged }: PautaDetailsTabProps) {
  const { pauta, members } = detail;
  const [editing, setEditing] = useState(false);
  // Etapa com que o "passar adiante" abre (null = fechado; "atual" = mantém o status de agora).
  const [handover, setHandover] = useState<PautaStatus | "atual" | null>(null);
  const [quickPending, startQuickTransition] = useTransition();

  const isProduction = (pauta.squad ?? "audiovisual") === "audiovisual";
  const clientContacts = pauta.company_id ? options.contacts.filter((contact) => contact.company_id === pauta.company_id) : [];

  function saveQuick(patch: Parameters<typeof updatePautaAction>[1], successMessage: string, local: Partial<PautaWithDetails>) {
    startQuickTransition(async () => {
      const result = await updatePautaAction(pauta.id!, patch);
      if (result.ok) {
        toast.success(successMessage);
        onChanged({ ...pauta, ...local });
      } else {
        toast.error(result.error);
      }
    });
  }

  async function saveLink(field: "scriptUrl" | "driveFolderUrl" | "deliveryUrl", column: "script_url" | "drive_folder_url" | "delivery_url", next: string | null) {
    const result = await updatePautaAction(pauta.id!, { [field]: next });
    if (!result.ok) {
      toast.error(result.error);
      return false;
    }
    toast.success(next ? "Link salvo." : "Link removido.");
    onChanged({ ...pauta, [column]: next });
    return true;
  }

  if (editing && canEditAll) {
    return (
      <PautaEditForm
        pauta={pauta}
        options={options}
        onCancel={() => setEditing(false)}
        onSaved={(updated) => {
          onChanged(updated);
          setEditing(false);
        }}
      />
    );
  }

  const inReview = pauta.status === "revisao_interna" || pauta.status === "revisao_cliente";
  const dueLabel = pauta.due_date ? `${formatDate(pauta.due_date)}${pauta.due_time ? ` até ${pauta.due_time.slice(0, 5)}` : ""}` : "—";

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-center gap-2">
        {pauta.status ? <PautaStatusBadge status={pauta.status} squad={pauta.squad} /> : null}
        <div className="ml-auto flex flex-wrap gap-2">
          {canApprove && inReview ? (
            <>
              <Button type="button" onClick={() => setHandover("aprovado")}>
                <CheckCircle2 aria-hidden />
                Aprovar
              </Button>
              <Button type="button" variant="secondary" onClick={() => setHandover("reajuste")}>
                <RotateCcw aria-hidden />
                Pedir ajuste
              </Button>
            </>
          ) : null}
          {canEditOperationally && pauta.status !== "aprovado" ? (
            <Button type="button" variant={canApprove && inReview ? "secondary" : "primary"} onClick={() => setHandover("atual")}>
              <ArrowRightCircle aria-hidden />
              Passar adiante
            </Button>
          ) : null}
          {canApprove && pauta.status === "aprovado" ? (
            <Button type="button" variant="secondary" onClick={() => setHandover("reajuste")}>
              <RotateCcw aria-hidden />
              Reabrir
            </Button>
          ) : null}
          {canEditAll ? (
            <Button type="button" variant="secondary" onClick={() => setEditing(true)}>
              <Pencil aria-hidden />
              Editar
            </Button>
          ) : null}
        </div>
      </div>

      <Section title="Sobre">
        <dl className="grid gap-4 sm:grid-cols-3">
          <Item label="Cliente">
            {pauta.company_id ? (
              <Link href={`/clientes/${pauta.company_id}`} className="underline underline-offset-4 hover:text-muted-foreground">
                {pauta.company_name}
              </Link>
            ) : pauta.is_standalone ? (
              "Tarefa interna"
            ) : (
              INTERNAL_PROJECT_LABEL
            )}
          </Item>
          <Item label="Projeto">
            {pauta.project_id ? (
              <Link href={`/projetos/${pauta.project_id}`} className="underline underline-offset-4 hover:text-muted-foreground">
                {pauta.project_name}
              </Link>
            ) : (
              <span className="text-muted-foreground">Sem projeto</span>
            )}
          </Item>
          <Item label="Squad">{pauta.squad ? <SquadBadge squad={pauta.squad} /> : "—"}</Item>
          <Item label="Prioridade">
            <span className="flex flex-wrap items-center gap-1.5">
              {pauta.priority ? PRIORITY_LABELS[pauta.priority] : "—"}
              {pauta.is_critical ? (
                <Badge variant="outline" className="border-2 border-foreground font-bold">
                  Crítica
                </Badge>
              ) : null}
            </span>
          </Item>
          {isProduction && pauta.capture_type?.length ? (
            <Item label="Captação">{pauta.capture_type.map((item) => PAUTA_CAPTURE_TYPE_LABELS[item]).join(" e ")}</Item>
          ) : null}
          {pauta.format ? <Item label="Formato">{pauta.format}</Item> : null}
        </dl>
      </Section>

      <Section title="Quando e onde">
        <dl className="grid gap-4 sm:grid-cols-3">
          {isProduction ? (
            <Item label="Captação">
              {pauta.scheduled_at ? `${formatDate(dateInAppZone(pauta.scheduled_at))} às ${timeInAppZone(pauta.scheduled_at)}` : "—"}
              {pauta.duration_minutes ? <span className="block text-[12px] font-normal text-subtle">{pauta.duration_minutes} min</span> : null}
            </Item>
          ) : null}
          <Item label="Início">{pauta.start_date ? formatDate(pauta.start_date) : "—"}</Item>
          <Item label="Prazo de entrega">{dueLabel}</Item>
          {pauta.location_address ? (
            <Item label="Local" wide>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pauta.location_address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 underline underline-offset-4 hover:text-muted-foreground"
              >
                <MapPin className="size-4 shrink-0" aria-hidden />
                {pauta.location_address}
              </a>
            </Item>
          ) : null}
          {pauta.contact_name ? (
            <Item label="Contato no cliente">
              {pauta.contact_name}
              {pauta.contact_phone ? <span className="block text-[13px] font-normal text-muted-foreground">{pauta.contact_phone}</span> : null}
            </Item>
          ) : null}
        </dl>
      </Section>

      <Section title="Briefing">
        {pauta.briefing ? (
          <p className="whitespace-pre-wrap rounded-md border border-border bg-surface-raised p-4 text-sm leading-relaxed">{pauta.briefing}</p>
        ) : (
          <p className="text-sm text-subtle">Sem briefing.</p>
        )}
        {pauta.equipment_notes ? (
          <p className="whitespace-pre-wrap text-[13px] text-muted-foreground">
            <span className="font-semibold text-foreground">Equipamentos / observações: </span>
            {pauta.equipment_notes}
          </p>
        ) : null}
      </Section>

      <Section title="Materiais">
        <div className="grid gap-3 sm:grid-cols-3">
          <MaterialLink
            label="Roteiro"
            icon={FileText}
            url={pauta.script_url}
            canEdit={canEditOperationally}
            onSave={(next) => saveLink("scriptUrl", "script_url", next)}
          />
          <MaterialLink
            label="Pasta do Drive"
            icon={FolderOpen}
            url={pauta.drive_folder_url}
            canEdit={canEditOperationally}
            onSave={(next) => saveLink("driveFolderUrl", "drive_folder_url", next)}
          />
          <MaterialLink
            label="Material / entrega"
            icon={isProduction ? Clapperboard : Package}
            url={pauta.delivery_url}
            canEdit={canEditOperationally}
            onSave={(next) => saveLink("deliveryUrl", "delivery_url", next)}
          />
        </div>
      </Section>

      <Section title="Pessoas">
        <dl className="grid gap-4 sm:grid-cols-2">
          <Item label="Líder (revisa)">
            <span className="flex items-center gap-2">
              <UserAvatar name={pauta.lead_name ?? "—"} src={pauta.lead_avatar_url} profileId={pauta.lead_id} className="size-6" />
              {pauta.lead_name ?? "—"}
            </span>
          </Item>
          <Item label="Com a bola agora (executa)">
            <span className="flex items-center gap-2">
              <UserAvatar name={pauta.assignee_name ?? "—"} src={pauta.assignee_avatar_url} profileId={pauta.current_assignee_id} className="size-6" />
              {pauta.assignee_name ?? "—"}
            </span>
          </Item>
        </dl>

        {members.some((member) => member.production_function === "nota_fiscal") || isInvoiceTaskTitle(pauta.title ?? "") ? (
          <InvoiceTaskCallout
            projectId={pauta.project_is_internal ? null : pauta.project_id}
            receivableId={pauta.source_ref_type === "receivable" ? pauta.source_ref_id : null}
          />
        ) : null}

        {members.length > 0 ? (
          <ul className="flex flex-wrap gap-2" aria-label="Responsáveis">
            {members.map((member) => (
              <li key={`${member.profile_id}-${member.production_function}`}>
                <Badge variant="muted" className="gap-2 py-1 pl-1.5">
                  <UserAvatar name={member.profile?.full_name ?? "—"} src={member.profile?.avatar_url ?? null} profileId={member.profile_id} className="size-5" />
                  {member.profile?.full_name} · {FUNCTION_LABELS[member.production_function]}
                </Badge>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          {pauta.company_id ? (
            <FormField id="pd-waiting" label="Com quem está no cliente" hint="Ex.: quem aprova. Só sinaliza — líder e responsável continuam cobrando.">
              {canEditOperationally ? (
                <Select
                  value={pauta.waiting_on_contact_id ?? NO_WAITING}
                  disabled={quickPending}
                  onValueChange={(value) => {
                    const id = value === NO_WAITING ? null : value;
                    const contact = clientContacts.find((item) => item.id === id);
                    saveQuick({ waitingOnContactId: id }, id ? "Marcado com o cliente." : "Não está mais com o cliente.", {
                      waiting_on_contact_id: id,
                      waiting_on_contact_name: contact?.full_name ?? null,
                      waiting_on_contact_role: null,
                    });
                  }}
                >
                  <SelectTrigger id="pd-waiting">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_WAITING}>Com a equipe da Além</SelectItem>
                    {clientContacts.map((contact) => (
                      <SelectItem key={contact.id} value={contact.id}>
                        {contact.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm font-semibold">
                  {pauta.waiting_on_contact_name
                    ? `${pauta.waiting_on_contact_name}${pauta.waiting_on_contact_role ? ` · ${pauta.waiting_on_contact_role}` : ""}`
                    : "Com a equipe da Além"}
                </p>
              )}
            </FormField>
          ) : null}

          {options.freelancers.length > 0 || pauta.freelancer_name ? (
            <FormField id="pd-freelancer" label="Freelancer" hint="Só sinaliza com quem está a execução.">
              {canEditOperationally && options.freelancers.length > 0 ? (
                <Select
                  value={pauta.freelancer_id ?? NO_FREELANCER}
                  disabled={quickPending}
                  onValueChange={(value) => {
                    const freelancerId = value === NO_FREELANCER ? null : value;
                    const name = options.freelancers.find((item) => item.id === freelancerId)?.full_name ?? null;
                    saveQuick({ freelancerId }, freelancerId ? "Freelancer definido." : "Freelancer removido.", {
                      freelancer_id: freelancerId,
                      freelancer_name: name,
                    });
                  }}
                >
                  <SelectTrigger id="pd-freelancer">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_FREELANCER}>Sem freelancer</SelectItem>
                    {options.freelancers.map((freelancer) => (
                      <SelectItem key={freelancer.id} value={freelancer.id}>
                        {freelancer.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm font-semibold">{pauta.freelancer_name ?? "—"}</p>
              )}
            </FormField>
          ) : null}
        </div>
      </Section>

      <p className="text-xs text-subtle">
        Criada {pauta.created_by_name ? `por ${pauta.created_by_name} ` : ""}em {formatDateTime(pauta.created_at!)}. Código {pauta.code}.
      </p>

      {handover ? (
        <HandoverDialog
          pauta={pauta}
          members={options.members}
          open
          onOpenChange={(next) => !next && setHandover(null)}
          onDone={onChanged}
          initialStatus={handover === "atual" ? undefined : handover}
          canApprove={canApprove}
        />
      ) : null}
    </div>
  );
}
