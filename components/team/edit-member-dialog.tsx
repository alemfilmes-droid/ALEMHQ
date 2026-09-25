"use client";

import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { updateMemberAction } from "@/app/(app)/equipe/actions";
import { FunctionPicker } from "@/components/team/function-picker";
import { RoleSelect } from "@/components/team/role-select";
import { SquadPicker } from "@/components/team/squad-picker";
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
} from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ORG_LEVEL_LABELS, ROLE_TITLE_SUGGESTIONS } from "@/lib/auth/org";
import { assignableOrgLevels, canManageOrgLevel } from "@/lib/auth/permissions";
import { updateMemberSchema, type UpdateMemberValues } from "@/lib/validations/team";
import type { ProfileWithSquads } from "@/types";

interface EditMemberDialogProps {
  member: ProfileWithSquads;
  viewer: ProfileWithSquads;
  viewerIsAdmin: boolean;
  isSelf: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditMemberDialog({ member, viewer, viewerIsAdmin, isSelf, open, onOpenChange }: EditMemberDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const canEditHierarchy = !isSelf && canManageOrgLevel(viewer.id, viewer, member);
  // Sempre inclui o nível atual da pessoa na lista, mesmo que o viewer não possa mais atribuí-lo,
  // para o Select nunca mostrar um valor fora das opções.
  const levelOptions = Array.from(new Set([...assignableOrgLevels(viewer), member.org_level]));

  const { register, control, handleSubmit, formState: { errors } } = useForm<UpdateMemberValues>({
    resolver: zodResolver(updateMemberSchema),
    defaultValues: {
      id: member.id,
      accessRole: member.access_role,
      functions: member.functions,
      squads: member.squads,
      jobTitle: member.job_title ?? "",
      orgLevel: member.org_level,
    },
  });

  const onSubmit = handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const result = await updateMemberAction(values);
      if (result.ok) {
        toast.success(result.message);
        onOpenChange(false);
      } else {
        setError(result.error);
      }
    });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar acesso.</DialogTitle>
          <DialogDescription>{member.full_name}</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-5">
          {error ? <Alert variant="error">{error}</Alert> : null}

          <FormField id={`title-${member.id}`} label="Cargo" hint="Ex.: CEO. Aparece ao lado do nome." error={errors.jobTitle?.message}>
            <Input id={`title-${member.id}`} list="cargo-suggestions" aria-describedby={`title-${member.id}-message`} {...register("jobTitle")} />
            <datalist id="cargo-suggestions">
              {ROLE_TITLE_SUGGESTIONS.map((suggestion) => (
                <option key={suggestion} value={suggestion} />
              ))}
            </datalist>
          </FormField>

          {canEditHierarchy ? (
            <FormField id={`org-level-${member.id}`} label="Nível hierárquico" hint="Define quem esta pessoa pode gerenciar e o acesso ao quadro global de pautas.">
              <Controller
                control={control}
                name="orgLevel"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id={`org-level-${member.id}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {levelOptions.map((level) => (
                        <SelectItem key={level} value={level}>
                          {ORG_LEVEL_LABELS[level]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
          ) : null}

          {viewerIsAdmin ? (
            <>
              <FormField
                id={`role-${member.id}`}
                label="Papel de acesso"
                hint={isSelf ? "Você não pode alterar o seu próprio papel." : undefined}
              >
                <Controller
                  control={control}
                  name="accessRole"
                  render={({ field }) => (
                    <RoleSelect id={`role-${member.id}`} value={field.value} onChange={field.onChange} disabled={isSelf} />
                  )}
                />
              </FormField>

              <Controller
                control={control}
                name="functions"
                render={({ field }) => <FunctionPicker idPrefix={`fn-${member.id}`} value={field.value} onChange={field.onChange} />}
              />

              <Controller
                control={control}
                name="squads"
                render={({ field }) => <SquadPicker idPrefix={`sq-${member.id}`} value={field.value} onChange={field.onChange} />}
              />
            </>
          ) : null}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" loading={pending}>
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
