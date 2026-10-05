"use client";

import { useState, useTransition } from "react";
import { Workflow } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeading } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { saveFinanceAutomationAction } from "@/features/settings/actions";
import type { FinanceAutomation } from "@/features/settings/queries";

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

/** Pautas automáticas do financeiro: o que gerar, com quanta antecedência, em que dia e para quem. */
export function FinanceAutomationCard({ initial, members }: { initial: FinanceAutomation; members: { id: string; full_name: string }[] }) {
  const [values, setValues] = useState(initial);
  const [pending, startTransition] = useTransition();
  const set = <K extends keyof FinanceAutomation>(key: K, value: FinanceAutomation[K]) => setValues((current) => ({ ...current, [key]: value }));

  function save() {
    startTransition(async () => {
      const result = await saveFinanceAutomationAction(values);
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
    });
  }

  const toggles: { key: "invoice" | "weekly" | "monthly" | "payments"; label: string; hint: string }[] = [
    { key: "invoice", label: "Emitir nota fiscal", hint: "Uma pauta por recebimento sem nota, antes do vencimento. A executora conclui." },
    { key: "weekly", label: "Relatório semanal do financeiro", hint: "Toda semana, no dia escolhido. A executora conclui." },
    { key: "monthly", label: "Fechamento do mês", hint: "No último dia do mês (em fim de semana, na sexta anterior). A executora conclui." },
    { key: "payments", label: "Pagamentos", hint: "Uma pauta por pagamento a vencer. Líder: diretoria — vai para Revisão e só o líder aprova." },
  ];

  return (
    <Card variant="static" id="pautas-financeiro" className="scroll-mt-24">
      <CardHeading icon={Workflow} tone="success" title="Pautas automáticas do financeiro" action={<Badge variant="outline">Diretoria</Badge>} />
      <CardContent className="space-y-5">
        <p className="text-[13px] text-muted-foreground">
          O sistema cria as pautas da rotina financeira a partir dos dados (todo dia às 8h e ao abrir o Financeiro), sem duplicar. Baixa de recebimento não vira pauta.
        </p>
        <ul className="space-y-3">
          {toggles.map((toggle) => (
            <li key={toggle.key} className="flex items-start gap-3">
              <Switch id={`fa-${toggle.key}`} checked={values[toggle.key]} onCheckedChange={(checked) => set(toggle.key, checked)} className="mt-0.5" />
              <label htmlFor={`fa-${toggle.key}`} className="text-sm leading-snug">
                <span className="font-semibold">{toggle.label}</span>
                <span className="block text-[13px] text-muted-foreground">{toggle.hint}</span>
              </label>
            </li>
          ))}
        </ul>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField id="fa-days" label="Antecedência (dias)" hint="Nota fiscal e pagamentos.">
            <Input id="fa-days" type="number" min={0} max={60} value={values.invoiceDaysBefore} onChange={(event) => set("invoiceDaysBefore", Number(event.target.value))} />
          </FormField>
          <FormField id="fa-dow" label="Dia do relatório semanal">
            <NativeSelect id="fa-dow" value={values.weeklyDow} onChange={(event) => set("weeklyDow", Number(event.target.value))}>
              {WEEKDAYS.map((day, index) => (
                <option key={day} value={index}>
                  {day}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField id="fa-executor" label="Quem executa" hint="Vazio: a executora do squad Financeiro.">
            <NativeSelect id="fa-executor" value={values.executorId ?? ""} onChange={(event) => set("executorId", event.target.value || null)}>
              <option value="">Automático</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.full_name}
                </option>
              ))}
            </NativeSelect>
          </FormField>
        </div>
        <div className="flex justify-end">
          <Button type="button" onClick={save} loading={pending}>
            Salvar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
