"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createCompanyAction, updateCompanyAction } from "@/app/(app)/clientes/actions";
import { CompanyLogoUploader } from "@/components/companies/company-logo-uploader";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ALL_COMPANY_LIFECYCLES, COMPANY_LIFECYCLES, COMPANY_SOURCES, LIFECYCLE_LABELS, SOURCE_LABELS } from "@/lib/domain";
import { companySchema, type CompanyValues } from "@/lib/validations/company";
import type { Company, CompanyLifecycle } from "@/types";

type CompanyFormDialogProps =
  | { mode: "create"; defaultLifecycle: CompanyLifecycle; trigger?: ReactNode }
  | { mode: "edit"; company: Company; trigger: ReactNode; canManageLogo?: boolean };

function toDefaults(props: CompanyFormDialogProps): CompanyValues {
  if (props.mode === "edit") {
    const { company } = props;
    return {
      name: company.name,
      lifecycle: company.lifecycle,
      source: company.source ?? "",
      sourceDetail: company.source_detail ?? "",
      document: company.document ?? "",
      city: company.city ?? "",
      instagram: company.instagram ?? "",
      website: company.website ?? "",
    };
  }
  return {
    name: "",
    lifecycle: props.defaultLifecycle,
    source: "",
    sourceDetail: "",
    document: "",
    city: "",
    instagram: "",
    website: "",
  };
}

const NO_SOURCE = "none";

export function CompanyFormDialog(props: CompanyFormDialogProps) {
  const isEdit = props.mode === "edit";
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<CompanyValues>({ resolver: zodResolver(companySchema), defaultValues: toDefaults(props) });
  const source = watch("source");

  function handleOpenChange(next: boolean) {
    setOpen(next);
    setError(null);
    if (next) reset(toDefaults(props));
  }

  const onSubmit = handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const result =
        props.mode === "edit" ? await updateCompanyAction(props.company.id, values) : await createCompanyAction(values);
      if (result && !result.ok) return setError(result.error);
      if (result?.ok) {
        toast.success(result.message);
        setOpen(false);
      }
    });
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {props.trigger ?? (
          <Button>
            <Plus aria-hidden />
            Nova empresa
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar empresa." : "Nova empresa."}</DialogTitle>
          <DialogDescription>Clientes podem ser cadastrados direto, sem passar pelo CRM.</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="space-y-5">
          {error ? <Alert variant="error">{error}</Alert> : null}

          {props.mode === "edit" && props.canManageLogo ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold">Logo</p>
              <CompanyLogoUploader companyId={props.company.id} companyName={props.company.name} logoUrl={props.company.logo_url} />
            </div>
          ) : null}
          {props.mode === "create" ? (
            <p className="text-[13px] text-subtle">O logo pode ser enviado logo depois do cadastro, no cabeçalho do cliente.</p>
          ) : null}

          <FormField id="company-name" label="Nome" error={errors.name?.message}>
            <Input id="company-name" aria-invalid={!!errors.name} aria-describedby={errors.name ? "company-name-message" : undefined} {...register("name")} />
          </FormField>

          <div className="grid gap-5 sm:grid-cols-2">
            <FormField id="company-lifecycle" label="Situação" hint={watch("lifecycle") === "former_client" ? "Ex-cliente: use “Reativar cliente”." : undefined}>
              <Controller
                control={control}
                name="lifecycle"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={field.value === "former_client"}>
                    <SelectTrigger id="company-lifecycle">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(field.value === "former_client" ? ALL_COMPANY_LIFECYCLES : COMPANY_LIFECYCLES).map((item) => (
                        <SelectItem key={item} value={item}>
                          {LIFECYCLE_LABELS[item]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>

            <FormField id="company-source" label="Origem">
              <Controller
                control={control}
                name="source"
                render={({ field }) => (
                  <Select
                    value={field.value === "" ? NO_SOURCE : field.value}
                    onValueChange={(value) => field.onChange(value === NO_SOURCE ? "" : value)}
                  >
                    <SelectTrigger id="company-source">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_SOURCE}>Não informada</SelectItem>
                      {COMPANY_SOURCES.map((item) => (
                        <SelectItem key={item} value={item}>
                          {SOURCE_LABELS[item]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
          </div>

          {source ? (
            <FormField id="company-source-detail" label="Detalhe da origem" hint="Ex.: quem indicou." error={errors.sourceDetail?.message}>
              <Input id="company-source-detail" aria-describedby="company-source-detail-message" {...register("sourceDetail")} />
            </FormField>
          ) : null}

          <div className="grid gap-5 sm:grid-cols-2">
            <FormField id="company-document" label="CNPJ" error={errors.document?.message}>
              <Input id="company-document" {...register("document")} />
            </FormField>
            <FormField id="company-city" label="Cidade" error={errors.city?.message}>
              <Input id="company-city" {...register("city")} />
            </FormField>
            <FormField id="company-instagram" label="Instagram" error={errors.instagram?.message}>
              <Input id="company-instagram" placeholder="@empresa" {...register("instagram")} />
            </FormField>
            <FormField id="company-website" label="Site" error={errors.website?.message}>
              <Input id="company-website" {...register("website")} />
            </FormField>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" loading={pending}>
              {isEdit ? "Salvar" : "Cadastrar empresa"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
