"use client";

import { useState, useTransition } from "react";
import { FileCheck2, Paperclip, Plus, Receipt, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AttachInvoiceDialog, InvoiceFileButton, NfseEmitButton } from "@/features/finance/components/invoice-controls";
import {
  attachIssuanceFileAction,
  createInvoiceScheduleAction,
  deleteInvoiceScheduleAction,
  markInvoiceIssuedAction,
  type InvoiceScheduleValues,
} from "@/features/projects/invoice-actions";
import type { InvoiceScheduleView } from "@/features/projects/invoices";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeading } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, formatDateTime } from "@/lib/format";

const NO_CONTACT = "__sem_contato__";

interface InvoiceSchedulesCardProps {
  projectId: string;
  schedules: InvoiceScheduleView[];
  canManage: boolean;
  members: { id: string; full_name: string }[];
  contacts: { id: string; full_name: string }[];
}

function whenLabel(schedule: InvoiceScheduleView) {
  return schedule.frequency === "mensal" ? `Todo dia ${schedule.dayOfMonth}` : `Em ${formatDate(schedule.issueDate!)}`;
}

/**
 * Nota fiscal do projeto: quando emitir (todo mês no dia X ou numa data), quem emite e para quem
 * enviar. O responsável recebe o lembrete no dia (e nos 7 dias seguintes até marcar como emitida).
 */
export function InvoiceSchedulesCard({ projectId, schedules, canManage, members, contacts }: InvoiceSchedulesCardProps) {
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<InvoiceScheduleValues>({
    projectId,
    frequency: "mensal",
    dayOfMonth: "1",
    issueDate: "",
    responsibleId: "",
    contactId: "",
    sendToEmail: "",
    notes: "",
  });
  const [numbers, setNumbers] = useState<Record<string, string>>({});
  const [attaching, setAttaching] = useState<InvoiceScheduleView | null>(null);

  function set<K extends keyof InvoiceScheduleValues>(key: K, value: InvoiceScheduleValues[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function save() {
    startTransition(async () => {
      const result = await createInvoiceScheduleAction(form);
      if (result.ok) {
        toast.success(result.message);
        setAdding(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteInvoiceScheduleAction(id, projectId);
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
    });
  }

  function markIssued(schedule: InvoiceScheduleView) {
    startTransition(async () => {
      const result = await markInvoiceIssuedAction({ scheduleId: schedule.id, projectId, period: schedule.period, invoiceNumber: numbers[schedule.id] ?? "" });
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
    });
  }

  return (
    <Card variant="static" id="nota-fiscal" className="scroll-mt-24">
      <CardHeading
        icon={Receipt}
        tone="success"
        title="Nota fiscal"
        action={
          canManage && !adding ? (
            <Button type="button" size="sm" variant="secondary" onClick={() => setAdding(true)}>
              <Plus aria-hidden />
              Agendar emissão
            </Button>
          ) : null
        }
      />
      <CardContent className="space-y-4">
        {schedules.length === 0 && !adding ? (
          <p className="text-sm text-muted-foreground">Nenhuma emissão agendada. Agende para o financeiro ser lembrado no dia certo.</p>
        ) : null}

        {schedules.length > 0 ? (
          <ul className="space-y-3">
            {schedules.map((schedule) => {
              const target = schedule.contactName ?? null;
              const email = schedule.sendToEmail ?? schedule.contactEmail;
              return (
                <li key={schedule.id} className="space-y-2 rounded-md border border-border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold">{whenLabel(schedule)}</span>
                    <Badge variant="muted">Emite: {schedule.responsibleName}</Badge>
                    {schedule.issued ? (
                      <Badge variant="outline">
                        <FileCheck2 aria-hidden />
                        Emitida {formatDateTime(schedule.issued.at)}
                        {schedule.issued.number ? ` · nº ${schedule.issued.number}` : ""}
                      </Badge>
                    ) : null}
                    {canManage ? (
                      <button
                        type="button"
                        onClick={() => remove(schedule.id)}
                        className="ml-auto rounded-sm p-1 text-subtle hover:text-foreground"
                        aria-label="Remover agendamento"
                        disabled={pending}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    ) : null}
                  </div>
                  {target || email ? (
                    <p className="text-[13px] text-muted-foreground">
                      Enviar para {target ?? ""}
                      {email ? `${target ? " · " : ""}${email}` : ""}
                    </p>
                  ) : null}
                  {schedule.notes ? <p className="text-[13px] text-subtle">{schedule.notes}</p> : null}
                  <div className="flex flex-wrap items-center gap-2">
                    <NfseEmitButton />
                    <Button type="button" size="sm" variant="secondary" onClick={() => setAttaching(schedule)} disabled={pending}>
                      <Paperclip aria-hidden />
                      {schedule.issued?.filePath ? "Trocar arquivo da nota" : "Anexar nota"}
                    </Button>
                    {schedule.issued?.filePath ? <InvoiceFileButton path={schedule.issued.filePath} /> : null}
                  </div>
                  {!schedule.issued ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        value={numbers[schedule.id] ?? ""}
                        onChange={(event) => setNumbers((current) => ({ ...current, [schedule.id]: event.target.value }))}
                        placeholder="Nº da nota (opcional)"
                        aria-label="Número da nota"
                        className="h-9 w-48"
                      />
                      <Button type="button" size="sm" onClick={() => markIssued(schedule)} disabled={pending}>
                        <FileCheck2 aria-hidden />
                        Marcar como emitida {schedule.frequency === "mensal" ? "(este mês)" : ""}
                      </Button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}

        {adding ? (
          <div className="space-y-4 rounded-md border border-border bg-surface-raised p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="nf-frequency" label="Quando emitir">
                <Select value={form.frequency} onValueChange={(value) => set("frequency", value as InvoiceScheduleValues["frequency"])}>
                  <SelectTrigger id="nf-frequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mensal">Todo mês</SelectItem>
                    <SelectItem value="unica">Uma vez (data)</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              {form.frequency === "mensal" ? (
                <FormField id="nf-day" label="Dia do mês">
                  <Input id="nf-day" inputMode="numeric" value={form.dayOfMonth} onChange={(event) => set("dayOfMonth", event.target.value.replace(/\D/g, "").slice(0, 2))} />
                </FormField>
              ) : (
                <FormField id="nf-date" label="Data da emissão">
                  <Input id="nf-date" type="date" value={form.issueDate} onChange={(event) => set("issueDate", event.target.value)} />
                </FormField>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="nf-responsible" label="Quem emite">
                <Select value={form.responsibleId || undefined} onValueChange={(value) => set("responsibleId", value)}>
                  <SelectTrigger id="nf-responsible">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField id="nf-contact" label="Enviar para (contato do cliente)">
                <Select value={form.contactId || NO_CONTACT} onValueChange={(value) => set("contactId", value === NO_CONTACT ? "" : value)}>
                  <SelectTrigger id="nf-contact">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CONTACT}>Nenhum contato</SelectItem>
                    {contacts.map((contact) => (
                      <SelectItem key={contact.id} value={contact.id}>
                        {contact.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>
            <FormField id="nf-email" label="E-mail de envio" hint="Opcional. Se vazio, usa o e-mail do contato.">
              <Input id="nf-email" type="email" value={form.sendToEmail} onChange={(event) => set("sendToEmail", event.target.value)} />
            </FormField>
            <FormField id="nf-notes" label="Observações" hint="Opcional. Ex.: descrição do serviço na nota.">
              <Textarea id="nf-notes" rows={2} value={form.notes} onChange={(event) => set("notes", event.target.value)} />
            </FormField>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setAdding(false)}>
                Cancelar
              </Button>
              <Button type="button" onClick={save} loading={pending}>
                Agendar
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>

      {attaching ? (
        <AttachInvoiceDialog
          title="Nota fiscal do projeto."
          description={`${whenLabel(attaching)} · emite: ${attaching.responsibleName}. Anexar já marca a nota do período como emitida.`}
          folder={`issuances/${attaching.id}`}
          initialNumber={attaching.issued?.number}
          hasFile={!!attaching.issued?.filePath}
          onSave={async ({ filePath, invoiceNumber }) => {
            if (!filePath) {
              if (attaching.issued) return { ok: false, error: "Escolha o arquivo da nota." };
              return markInvoiceIssuedAction({ scheduleId: attaching.id, projectId, period: attaching.period, invoiceNumber });
            }
            return attachIssuanceFileAction({ scheduleId: attaching.id, projectId, period: attaching.period, filePath, invoiceNumber });
          }}
          onOpenChange={(next) => !next && setAttaching(null)}
        />
      ) : null}
    </Card>
  );
}
