"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { centsToInput, formatCents } from "@/features/finance/money";
import { saveGoalAction } from "@/features/goals/actions";
import { goalCommission } from "@/features/goals/progress";
import { goalSchema, parseHundredths, type GoalValues } from "@/features/goals/schemas";
import { COMMISSION_MODE_LABELS, CRM_METRICS, DEAL_METRICS, GOAL_METRICS, GOAL_METRIC_LABELS, type GoalItem } from "@/features/goals/types";
import { addDays, addMonths, startOfMonth, todayInAppZone } from "@/lib/calendar";

interface GoalFormDialogProps {
  goal?: GoalItem;
  owners: { id: string; name: string }[];
  onOpenChange: (open: boolean) => void;
}

const decimal = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2, useGrouping: false });

function defaults(goal?: GoalItem): GoalValues {
  if (goal) {
    return {
      title: goal.title,
      description: goal.description ?? "",
      ownerId: goal.ownerId,
      metric: goal.metric,
      unitLabel: goal.unitLabel ?? "",
      isMoney: goal.isMoney,
      target: goal.isMoney ? centsToInput(goal.target) : decimal.format(goal.target / 100),
      startsOn: goal.startsOn,
      endsOn: goal.endsOn,
      commissionMode: goal.commissionMode,
      commissionRate: goal.commissionMode === "por_unidade" ? centsToInput(goal.commissionRate) : decimal.format(goal.commissionRate),
      fallbackRate: decimal.format(goal.fallbackRate),
      minAchievementPct: decimal.format(goal.minAchievementPct),
      autoFromCrm: goal.autoFromCrm,
    };
  }
  const monthStart = startOfMonth(todayInAppZone());
  return {
    title: "",
    description: "",
    ownerId: "",
    metric: "vendas_valor",
    unitLabel: "",
    isMoney: false,
    target: "",
    startsOn: monthStart,
    endsOn: addDays(addMonths(monthStart, 1), -1),
    commissionMode: "percentual",
    commissionRate: "",
    fallbackRate: "3",
    minAchievementPct: "70",
    autoFromCrm: true,
  };
}

/** Criar/editar meta (diretoria). Mostra ao vivo quanto a pessoa recebe no gatilho e em 100%. */
export function GoalFormDialog({ goal, owners, onOpenChange }: GoalFormDialogProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<GoalValues>({ resolver: zodResolver(goalSchema), defaultValues: defaults(goal) });

  const [metric, isMoney, mode, target, rate, minPct, fallback] = useWatch({
    control,
    name: ["metric", "isMoney", "commissionMode", "target", "commissionRate", "minAchievementPct", "fallbackRate"],
  });
  const money = metric === "vendas_valor" || (metric === "personalizada" && isMoney);
  const crmCapable = CRM_METRICS.includes(metric);
  const dealMetric = DEAL_METRICS.includes(metric);
  const contracts = mode === "contratos_fechados";
  const fallbackH = parseHundredths(fallback || "") ?? 0;

  // Simulação: comissão no gatilho e em 100% (centésimos).
  const targetH = parseHundredths(target || "") ?? 0;
  const rateH = parseHundredths(rate || "") ?? 0;
  const minH = parseHundredths(minPct || "") ?? 0;
  const rateForCalc = mode === "por_unidade" ? rateH : rateH / 100;
  const atMin = goalCommission(rateForCalc, minH / 100, targetH, Math.ceil((targetH * minH) / 10000));
  const atFull = goalCommission(rateForCalc, minH / 100, targetH, targetH);

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      const result = await saveGoalAction(values, goal?.id);
      if (result.ok) {
        toast.success(result.message);
        onOpenChange(false);
        if (!goal && result.id) router.push(`/metas/${result.id}`);
      } else toast.error(result.error);
    });
  });

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{goal ? "Editar meta." : "Nova meta."}</DialogTitle>
          <DialogDescription>O responsável é avisado na hora e recebe o andamento todo dia às 8h.</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="meta-titulo" label="Título" error={errors.title?.message} className="sm:col-span-2">
              <Input id="meta-titulo" placeholder="Meta de outubro · SDR" aria-invalid={!!errors.title} {...register("title")} />
            </FormField>

            <FormField id="meta-responsavel" label="Responsável" error={errors.ownerId?.message}>
              <NativeSelect id="meta-responsavel" aria-invalid={!!errors.ownerId} {...register("ownerId")}>
                <option value="">Escolha…</option>
                {owners.map((owner) => (
                  <option key={owner.id} value={owner.id}>
                    {owner.name}
                  </option>
                ))}
              </NativeSelect>
            </FormField>

            <FormField id="meta-metrica" label="Métrica" error={errors.metric?.message}>
              <NativeSelect
                id="meta-metrica"
                {...register("metric", {
                  onChange: (event) => {
                    const next = event.target.value as GoalValues["metric"];
                    if (DEAL_METRICS.includes(next)) {
                      // Contas/reuniões: o padrão é pagar sobre os contratos que fecharem (garante margem).
                      setValue("commissionMode", "contratos_fechados");
                      setValue("autoFromCrm", true);
                    } else if (next === "vendas_valor") setValue("commissionMode", "percentual");
                    else if (!(next === "personalizada" && isMoney)) setValue("commissionMode", "por_unidade");
                  },
                })}
              >
                {GOAL_METRICS.map((item) => (
                  <option key={item} value={item}>
                    {GOAL_METRIC_LABELS[item]}
                  </option>
                ))}
              </NativeSelect>
            </FormField>

            {metric === "personalizada" ? (
              <>
                <Controller
                  control={control}
                  name="isMoney"
                  render={({ field }) => (
                    <div className="flex items-center gap-3 sm:pt-7">
                      <Switch
                        id="meta-dinheiro"
                        checked={field.value}
                        onCheckedChange={(checked) => {
                          field.onChange(checked);
                          if (!checked) setValue("commissionMode", "por_unidade");
                        }}
                      />
                      <Label htmlFor="meta-dinheiro" className="font-normal">
                        A meta é em R$
                      </Label>
                    </div>
                  )}
                />
                {!isMoney ? (
                  <FormField id="meta-unidade" label="Unidade" hint="No plural: leads, posts, visitas." error={errors.unitLabel?.message}>
                    <Input id="meta-unidade" aria-invalid={!!errors.unitLabel} {...register("unitLabel")} />
                  </FormField>
                ) : null}
              </>
            ) : null}

            <FormField id="meta-alvo" label={money ? "Alvo (R$)" : "Alvo (quantidade)"} error={errors.target?.message}>
              <Input id="meta-alvo" inputMode="decimal" placeholder={money ? "50.000,00" : "40"} aria-invalid={!!errors.target} {...register("target")} />
            </FormField>

            <div className="grid grid-cols-2 gap-2">
              <FormField id="meta-inicio" label="Início" error={errors.startsOn?.message}>
                <Input id="meta-inicio" type="date" {...register("startsOn")} />
              </FormField>
              <FormField id="meta-fim" label="Fim" error={errors.endsOn?.message}>
                <Input id="meta-fim" type="date" aria-invalid={!!errors.endsOn} {...register("endsOn")} />
              </FormField>
            </div>
          </div>

          <fieldset className="space-y-4 rounded-lg border border-border p-4">
            <legend className="eyebrow px-1">Comissão</legend>
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField id="meta-modo" label="Como calcula" error={errors.commissionMode?.message}>
                <NativeSelect id="meta-modo" aria-invalid={!!errors.commissionMode} {...register("commissionMode")}>
                  <option value="percentual" disabled={!money}>
                    {COMMISSION_MODE_LABELS.percentual}
                  </option>
                  <option value="por_unidade">{COMMISSION_MODE_LABELS.por_unidade}</option>
                  <option value="contratos_fechados" disabled={!dealMetric}>
                    {COMMISSION_MODE_LABELS.contratos_fechados}
                  </option>
                </NativeSelect>
              </FormField>
              <FormField
                id="meta-taxa"
                label={contracts ? "Bateu o mínimo (%)" : mode === "percentual" ? "Percentual (%)" : "Valor por unidade (R$)"}
                error={errors.commissionRate?.message}
              >
                <Input id="meta-taxa" inputMode="decimal" placeholder={mode === "por_unidade" ? "30,00" : "5"} aria-invalid={!!errors.commissionRate} {...register("commissionRate")} />
              </FormField>
              <FormField id="meta-gatilho" label="Paga a partir de (%)" error={errors.minAchievementPct?.message}>
                <Input id="meta-gatilho" inputMode="decimal" aria-invalid={!!errors.minAchievementPct} {...register("minAchievementPct")} />
              </FormField>
            </div>
            {contracts ? (
              <FormField id="meta-fixa" label="Abaixo do mínimo, paga só (%)" hint="A comissão fixa padrão do CRM." error={errors.fallbackRate?.message} className="sm:max-w-[12rem]">
                <Input id="meta-fixa" inputMode="decimal" aria-invalid={!!errors.fallbackRate} {...register("fallbackRate")} />
              </FormField>
            ) : null}
            {contracts ? (
              <p className="text-[13px] text-muted-foreground">
                A barra mede as contas cadastradas, mas a comissão é sobre os <strong className="text-foreground">contratos que fecharem</strong> dessas
                contas — inclusive depois do fim da meta. Bateu {decimal.format(minH / 100)}% da meta:{" "}
                <strong className="text-foreground">{decimal.format(rateH / 100)}%</strong> sobre cada contrato. Abaixo disso: só{" "}
                <strong className="text-foreground">{decimal.format(fallbackH / 100)}%</strong>, mesmo que o cliente feche.
              </p>
            ) : (
            <p className="text-[13px] text-muted-foreground">
              Abaixo de {decimal.format(minH / 100)}% da meta não há comissão. A partir daí, paga proporcional ao atingido
              {targetH > 0 && rateH > 0 ? (
                <>
                  : <strong className="text-foreground">{formatCents(atMin)}</strong> em {decimal.format(minH / 100)}% e{" "}
                  <strong className="text-foreground">{formatCents(atFull)}</strong> em 100%.
                </>
              ) : (
                "."
              )}
            </p>
            )}
          </fieldset>

          {crmCapable ? (
            <Controller
              control={control}
              name="autoFromCrm"
              render={({ field }) => (
                <div className="flex items-start gap-3">
                  <Switch id="meta-crm" checked={field.value} onCheckedChange={field.onChange} disabled={contracts && field.value} className="mt-0.5" />
                  <Label htmlFor="meta-crm" className="font-normal leading-snug">
                    Alimentar pelo CRM
                    <span className="block text-[13px] text-muted-foreground">
                      Negócios e reuniões do responsável entram sozinhos (a confirmar). Ele ainda pode lançar à mão.
                    </span>
                  </Label>
                </div>
              )}
            />
          ) : null}

          <FormField id="meta-descricao" label="Observações (opcional)" error={errors.description?.message}>
            <Textarea id="meta-descricao" rows={3} placeholder="Regras combinadas, o que conta, o que não conta." {...register("description")} />
          </FormField>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={pending}>
              {goal ? "Salvar" : "Criar meta"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
