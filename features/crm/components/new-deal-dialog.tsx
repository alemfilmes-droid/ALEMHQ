"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Plus } from "lucide-react";
import { toast } from "sonner";
import { createDealAction, findSimilarCompaniesAction } from "@/features/crm/actions";
import { tomorrowISO } from "@/features/crm/dates";
import { NextActionFields } from "@/features/crm/components/flow/fields";
import { PROSPECTION_GOALS, PROSPECTION_GOAL_LABELS } from "@/features/crm/labels";
import { dealSchema, type DealValues } from "@/features/crm/schemas";
import type { DealFormOptions } from "@/features/crm/types";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { COMPANY_SOURCES, LIFECYCLE_LABELS, SOURCE_LABELS } from "@/lib/domain";
import type { CompanyLifecycle } from "@/types";
import { useCrmFlow } from "@/features/crm/components/flow/crm-flow-provider";

interface NewDealDialogProps {
  options: DealFormOptions;
  canManageAll: boolean;
  defaultOwnerId: string;
}

const EMPTY = (ownerId: string): DealValues => ({
  companyMode: "nova",
  companyId: "",
  companyName: "",
  document: "",
  segment: "",
  city: "",
  instagram: "",
  website: "",
  primaryContactId: "",
  contactName: "",
  contactJobTitle: "",
  contactPhone: "",
  contactEmail: "",
  title: "",
  ownerId,
  goals: [],
  estimatedValue: "",
  expectedCloseDate: "",
  source: "",
  nextAction: "",
  nextActionDate: tomorrowISO(),
  nextActionTime: "09:00",
});

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="eyebrow border-t border-border pt-5">{children}</p>;
}

type Similar = { id: string; name: string; document: string | null; lifecycle: CompanyLifecycle };

/**
 * Cria o negócio e, se preciso, a empresa (prospect) e o primeiro contato numa transação só — na
 * mesma tabela `companies`, então o prospect já aparece em /clientes. Nunca obriga cadastrar o cliente antes.
 */
export function NewDealDialog({ options, canManageAll, defaultOwnerId }: NewDealDialogProps) {
  const flow = useCrmFlow();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [similar, setSimilar] = useState<Similar[]>([]);
  const [pending, startTransition] = useTransition();
  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<DealValues>({ resolver: zodResolver(dealSchema), defaultValues: EMPTY(defaultOwnerId) });
  const mode = watch("companyMode");
  const companyId = watch("companyId");
  const companyName = watch("companyName");
  const documentValue = watch("document");
  const companyContacts = options.contacts.filter((contact) => contact.company_id === companyId);

  // Aviso de duplicidade por nome/CNPJ ao digitar (com um pequeno atraso).
  useEffect(() => {
    if (mode !== "nova") {
      setSimilar([]);
      return;
    }
    const timer = setTimeout(() => {
      findSimilarCompaniesAction({ name: companyName, document: documentValue }).then(setSimilar);
    }, 400);
    return () => clearTimeout(timer);
  }, [mode, companyName, documentValue]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      reset(EMPTY(defaultOwnerId));
      setError(null);
      setSimilar([]);
    }
  }

  function selectExisting(id: string) {
    setValue("companyMode", "existente");
    setValue("companyId", id);
    setValue("primaryContactId", "");
  }

  const onSubmit = handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const result = await createDealAction(values);
      if (result.ok) {
        toast.success(result.message);
        handleOpenChange(false);
        if (result.id) flow.openDeal(result.id);
      } else {
        setError(result.error);
      }
    });
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus aria-hidden />
          Novo negócio
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Novo negócio.</DialogTitle>
          <DialogDescription>Entra no funil em Prospecção. Empresa nova já aparece em Clientes, na aba Prospects.</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="space-y-5">
          {error ? <Alert variant="error">{error}</Alert> : null}

          <p className="eyebrow">Empresa</p>
          <div className="flex gap-2" role="radiogroup" aria-label="Empresa">
            {(["nova", "existente"] as const).map((item) => (
              <label
                key={item}
                className={`flex-1 cursor-pointer rounded-md border px-3 py-2 text-center text-sm font-semibold ${mode === item ? "border-foreground text-foreground" : "border-border text-muted-foreground"}`}
              >
                <input type="radio" value={item} className="sr-only" {...register("companyMode")} />
                {item === "nova" ? "Nova empresa" : "Empresa já cadastrada"}
              </label>
            ))}
          </div>

          {mode === "existente" ? (
            <>
              <FormField id="deal-company" label="Empresa" error={errors.companyId?.message}>
                <NativeSelect id="deal-company" aria-invalid={!!errors.companyId} {...register("companyId", { onChange: () => setValue("primaryContactId", "") })}>
                  <option value="">Selecione a empresa</option>
                  {options.companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
              <FormField id="deal-contact" label="Contato" hint="Opcional.">
                <NativeSelect id="deal-contact" disabled={!companyId} {...register("primaryContactId")}>
                  <option value="">Sem contato definido</option>
                  {companyContacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {contact.full_name}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
            </>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField id="deal-company-name" label="Nome da empresa" error={errors.companyName?.message}>
                  <Input id="deal-company-name" aria-invalid={!!errors.companyName} {...register("companyName")} />
                </FormField>
                <FormField id="deal-document" label="CNPJ" hint="Opcional." error={errors.document?.message}>
                  <Input id="deal-document" {...register("document")} />
                </FormField>
                <FormField id="deal-segment" label="Segmento" hint="Opcional." error={errors.segment?.message}>
                  <Input id="deal-segment" placeholder="Ex.: varejo, saúde, educação" {...register("segment")} />
                </FormField>
                <FormField id="deal-city" label="Cidade" hint="Opcional." error={errors.city?.message}>
                  <Input id="deal-city" {...register("city")} />
                </FormField>
                <FormField id="deal-instagram" label="Instagram" hint="Opcional." error={errors.instagram?.message}>
                  <Input id="deal-instagram" placeholder="@empresa" {...register("instagram")} />
                </FormField>
                <FormField id="deal-website" label="Site" hint="Opcional." error={errors.website?.message}>
                  <Input id="deal-website" {...register("website")} />
                </FormField>
              </div>

              {similar.length > 0 ? (
                <div className="space-y-2 rounded-md border border-border-strong p-3" role="status">
                  <p className="flex items-center gap-2 text-sm font-bold">
                    <AlertTriangle className="size-4" aria-hidden />
                    Já existe algo parecido cadastrado
                  </p>
                  <ul className="space-y-1.5">
                    {similar.map((item) => (
                      <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span>
                          <Link href={`/clientes/${item.id}`} target="_blank" className="font-semibold underline underline-offset-4">
                            {item.name}
                          </Link>
                          <span className="text-muted-foreground">
                            {" "}
                            · {LIFECYCLE_LABELS[item.lifecycle]}
                            {item.document ? ` · ${item.document}` : ""}
                          </span>
                        </span>
                        <Button type="button" size="sm" variant="secondary" onClick={() => selectExisting(item.id)}>
                          Usar esta empresa
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <SectionTitle>Primeiro contato</SectionTitle>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField id="deal-contact-name" label="Nome" error={errors.contactName?.message}>
                  <Input id="deal-contact-name" aria-invalid={!!errors.contactName} {...register("contactName")} />
                </FormField>
                <FormField id="deal-contact-job" label="Cargo" hint="Opcional." error={errors.contactJobTitle?.message}>
                  <Input id="deal-contact-job" {...register("contactJobTitle")} />
                </FormField>
                <FormField id="deal-contact-phone" label="WhatsApp" hint="Opcional." error={errors.contactPhone?.message}>
                  <Input id="deal-contact-phone" inputMode="tel" {...register("contactPhone")} />
                </FormField>
                <FormField id="deal-contact-email" label="E-mail" hint="Opcional." error={errors.contactEmail?.message}>
                  <Input id="deal-contact-email" type="email" {...register("contactEmail")} />
                </FormField>
              </div>
            </>
          )}

          <SectionTitle>Negócio</SectionTitle>
          <FormField id="deal-title" label="Título do negócio" error={errors.title?.message}>
            <Input id="deal-title" placeholder="Ex.: Campanha institucional 2026" aria-invalid={!!errors.title} {...register("title")} />
          </FormField>

          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-semibold">Objetivo da prospecção</legend>
            <Controller
              control={control}
              name="goals"
              render={({ field }) => (
                <div className="grid gap-2 sm:grid-cols-2">
                  {PROSPECTION_GOALS.map((goal) => (
                    <div key={goal} className="flex items-center gap-2 rounded-md border border-border px-3 py-2">
                      <Checkbox
                        id={`new-goal-${goal}`}
                        checked={field.value.includes(goal)}
                        onCheckedChange={(checked) => field.onChange(checked === true ? [...field.value, goal] : field.value.filter((item) => item !== goal))}
                      />
                      <Label htmlFor={`new-goal-${goal}`} className="flex-1 cursor-pointer font-normal">
                        {PROSPECTION_GOAL_LABELS[goal]}
                      </Label>
                    </div>
                  ))}
                </div>
              )}
            />
            {errors.goals ? <p className="text-[13px] font-semibold">{errors.goals.message}</p> : null}
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="deal-owner" label="SDR responsável" error={errors.ownerId?.message}>
              <NativeSelect id="deal-owner" disabled={!canManageAll} {...register("ownerId")}>
                {options.members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.full_name}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField id="deal-source" label="Origem" hint="Opcional.">
              <NativeSelect id="deal-source" {...register("source")}>
                <option value="">Sem origem definida</option>
                {COMPANY_SOURCES.map((source) => (
                  <option key={source} value={source}>
                    {SOURCE_LABELS[source]}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField id="deal-value" label="Valor estimado (R$)" hint="Opcional." error={errors.estimatedValue?.message}>
              <Input id="deal-value" inputMode="decimal" placeholder="0,00" {...register("estimatedValue")} />
            </FormField>
            <FormField id="deal-close-date" label="Previsão de fechamento" hint="Opcional." error={errors.expectedCloseDate?.message}>
              <Input id="deal-close-date" type="date" {...register("expectedCloseDate")} />
            </FormField>
          </div>

          <SectionTitle>Próxima ação (obrigatória)</SectionTitle>
          <NextActionFields register={register} errors={errors} idPrefix="new" />

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" loading={pending}>
              Criar negócio
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
