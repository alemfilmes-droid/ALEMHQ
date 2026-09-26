"use client";

import { useState, useTransition } from "react";
import { Banknote, Briefcase, CalendarDays, Clock, FolderKanban, ListChecks, Megaphone, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { saveNotificationPreferencesAction } from "@/features/settings/actions";
import type { NotificationPreference, NotificationPreferences } from "@/features/settings/queries";

const ROWS: { key: NotificationPreference; label: string; hint: string; icon: LucideIcon }[] = [
  { key: "notify_pautas", label: "Pautas", hint: "Líder, responsável, revisão, reajuste e handover.", icon: ListChecks },
  { key: "notify_projetos", label: "Projetos", hint: "Quando você vira dono ou entra na equipe de um projeto.", icon: FolderKanban },
  { key: "notify_agenda", label: "Agenda", hint: "Convites e mudanças em compromissos.", icon: CalendarDays },
  { key: "notify_comercial", label: "Comercial", hint: "Negócios, reuniões, qualificação e reaquecimento no CRM.", icon: Briefcase },
  { key: "notify_financeiro", label: "Financeiro", hint: "Recebimentos e pagamentos em atraso.", icon: Banknote },
  { key: "notify_avisos", label: "Avisos", hint: "Novos comunicados da diretoria. O selo na barra lateral continua.", icon: Megaphone },
  { key: "notify_banco_horas", label: "Banco de horas", hint: "Avisos sobre o seu ponto e o saldo de horas.", icon: Clock },
];

/** Um interruptor por tipo. O banco descarta a notificação desligada antes de gravar (gatilho em notifications). */
export function NotificationPreferencesForm({ initial }: { initial: NotificationPreferences }) {
  const [values, setValues] = useState(initial);
  const [pending, startTransition] = useTransition();
  const dirty = ROWS.some((row) => values[row.key] !== initial[row.key]);

  return (
    <div className="space-y-4">
      <ul className="divide-y divide-border">
        {ROWS.map((row) => {
          const Icon = row.icon;
          const id = `pref-${row.key}`;
          return (
            <li key={row.key} className="flex items-center gap-4 py-3">
              <Icon className="size-4 shrink-0 text-subtle" aria-hidden />
              <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
                <span className="block text-sm font-semibold">{row.label}</span>
                <span className="block text-[13px] text-muted-foreground">{row.hint}</span>
              </label>
              <Switch id={id} checked={values[row.key]} onCheckedChange={(checked) => setValues((current) => ({ ...current, [row.key]: checked }))} />
            </li>
          );
        })}
      </ul>
      <div className="flex justify-end">
        <Button
          size="sm"
          variant="secondary"
          disabled={!dirty}
          loading={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await saveNotificationPreferencesAction(values);
              if (result.ok) toast.success(result.message);
              else toast.error(result.error);
            })
          }
        >
          Salvar preferências
        </Button>
      </div>
    </div>
  );
}
