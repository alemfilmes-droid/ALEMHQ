"use client";

import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Copy, MessageCircle, Pencil, Star } from "lucide-react";
import { toast } from "sonner";
import { updateContactAction } from "@/app/(app)/clientes/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserAvatar } from "@/components/ui/avatar";
import { toWhatsAppUrl } from "@/lib/phone";
import { updateContactSchema, type UpdateContactValues } from "@/lib/validations/company";
import type { Contact } from "@/types";

interface ContactPanelDialogProps {
  contact: Contact;
  canManage: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          toast.success(`${label} copiado.`);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          toast.error("Não foi possível copiar.");
        }
      }}
      className="rounded-sm p-1 text-subtle transition-colors hover:bg-surface-hover hover:text-foreground"
      aria-label={`Copiar ${label.toLowerCase()}`}
    >
      {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
    </button>
  );
}

export function ContactPanelDialog({ contact, canManage, open, onOpenChange }: ContactPanelDialogProps) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateContactValues>({
    resolver: zodResolver(updateContactSchema),
    defaultValues: {
      id: contact.id,
      fullName: contact.full_name,
      jobTitle: contact.job_title ?? "",
      email: contact.email ?? "",
      phone: contact.phone ?? "",
      isDecisionMaker: contact.is_decision_maker,
    },
  });

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      const result = await updateContactAction(values);
      if (result.ok) {
        toast.success(result.message);
        setEditing(false);
      } else {
        toast.error(result.error);
      }
    });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {editing ? (
          <>
            <DialogHeader>
              <DialogTitle>Editar contato.</DialogTitle>
            </DialogHeader>
            <form onSubmit={onSubmit} noValidate className="space-y-5">
              <FormField id="cp-name" label="Nome" error={errors.fullName?.message}>
                <Input id="cp-name" {...register("fullName")} aria-invalid={!!errors.fullName} />
              </FormField>
              <FormField id="cp-title" label="Cargo" error={errors.jobTitle?.message}>
                <Input id="cp-title" {...register("jobTitle")} />
              </FormField>
              <div className="grid gap-5 sm:grid-cols-2">
                <FormField id="cp-email" label="E-mail" error={errors.email?.message}>
                  <Input id="cp-email" type="email" {...register("email")} aria-invalid={!!errors.email} />
                </FormField>
                <FormField id="cp-phone" label="Telefone" error={errors.phone?.message}>
                  <Input id="cp-phone" type="tel" {...register("phone")} aria-invalid={!!errors.phone} />
                </FormField>
              </div>
              <div className="flex items-center gap-2">
                <Controller
                  control={control}
                  name="isDecisionMaker"
                  render={({ field }) => (
                    <Checkbox id="cp-decision" checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)} />
                  )}
                />
                <Label htmlFor="cp-decision" className="cursor-pointer font-normal">
                  É decisor(a)
                </Label>
              </div>
              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
                  Cancelar
                </Button>
                <Button type="submit" loading={pending}>
                  Salvar
                </Button>
              </DialogFooter>
            </form>
          </>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <UserAvatar name={contact.full_name} className="size-11" />
                <div>
                  <DialogTitle className="flex items-center gap-2 text-xl">
                    {contact.full_name}
                    {contact.is_decision_maker ? <Badge variant="muted"><Star className="size-3" aria-hidden />Decisor(a)</Badge> : null}
                  </DialogTitle>
                  <DialogDescription>{contact.job_title ?? "Sem cargo"}</DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-3">
              {contact.phone ? (
                <div className="flex items-center justify-between rounded-md border border-border px-3 py-2.5">
                  <span className="text-sm font-semibold">{contact.phone}</span>
                  <div className="flex items-center gap-1">
                    <CopyButton value={contact.phone} label="Telefone" />
                    <a
                      href={toWhatsAppUrl(contact.phone)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 rounded-sm px-2 py-1 text-[13px] font-semibold text-foreground underline underline-offset-4 hover:text-muted-foreground"
                    >
                      <MessageCircle className="size-3.5" aria-hidden />
                      Abrir WhatsApp
                    </a>
                  </div>
                </div>
              ) : null}
              {contact.email ? (
                <div className="flex items-center justify-between rounded-md border border-border px-3 py-2.5">
                  <a href={`mailto:${contact.email}`} className="truncate text-sm font-semibold hover:underline">
                    {contact.email}
                  </a>
                  <CopyButton value={contact.email} label="E-mail" />
                </div>
              ) : null}
              {!contact.phone && !contact.email ? <p className="text-sm text-muted-foreground">Sem telefone ou e-mail cadastrado.</p> : null}
            </div>

            <DialogFooter>
              {canManage ? (
                <Button type="button" variant="secondary" onClick={() => setEditing(true)}>
                  <Pencil aria-hidden />
                  Editar
                </Button>
              ) : null}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
