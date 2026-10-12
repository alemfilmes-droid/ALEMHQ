"use client";

import { useState } from "react";
import { AlertTriangle, BookOpen, Plus, Power, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeading } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { PROSPECTION_GOALS, PROSPECTION_GOAL_LABELS } from "@/features/crm/labels";
import { useSave } from "@/features/prospeccao/components/use-save";
import {
  AUDIENCES,
  AUDIENCE_LABELS,
  CADENCE_TYPES,
  CADENCE_TYPE_LABELS,
  TOUCH_ZERO_VARIANTS,
  TOUCH_ZERO_VARIANT_LABELS,
} from "@/features/prospeccao/labels";
import { savePlaybookAction, setPlaybookActiveAction } from "@/features/prospeccao/playbook-actions";
import type { PlaybookInput } from "@/features/prospeccao/schemas";
import type { PlaybookView } from "@/features/prospeccao/types";
import { playbookLink } from "@/lib/prospeccao/render";

const EXAMPLE_SCHOOL = "Colégio Exemplo";

type Draft = Omit<PlaybookInput, "caseText"> & { caseText: string };

function toDraft(playbook: PlaybookView): Draft {
  return {
    id: playbook.id,
    name: playbook.name,
    audience: playbook.audience,
    cadenceType: playbook.cadence_type,
    touchZeroVariant: playbook.touch_zero_variant,
    crmGoal: playbook.crm_goal,
    usesHouseClientScript: playbook.uses_house_client_script,
    linkBase: playbook.link_base,
    linkAppendsSchoolParam: playbook.link_appends_school_param,
    caseText: playbook.case_text ?? "",
    houseSuggestionIds: playbook.houseSuggestionIds,
  };
}

const EMPTY: Draft = {
  id: null,
  name: "",
  audience: "empresa",
  cadenceType: "relacionamento",
  touchZeroVariant: "empresa",
  crmGoal: "outro",
  usesHouseClientScript: false,
  linkBase: "",
  linkAppendsSchoolParam: false,
  caseText: "",
  houseSuggestionIds: [],
};

/** Aba Playbooks: cadastrar, editar e desativar; link, {case} e sugestões de cliente da casa. */
export function PlaybooksPanel({ playbooks }: { playbooks: PlaybookView[] }) {
  const [creating, setCreating] = useState(false);
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Cada lead recebe um playbook: ele define a cadência, os scripts e o link.</p>
        {!creating ? (
          <Button type="button" size="lg" variant="secondary" onClick={() => setCreating(true)}>
            <Plus aria-hidden />
            Novo playbook
          </Button>
        ) : null}
      </div>
      {creating ? <PlaybookCard initial={EMPTY} playbooks={playbooks} onDone={() => setCreating(false)} /> : null}
      {playbooks.map((playbook) => (
        <PlaybookCard key={playbook.id} initial={toDraft(playbook)} active={playbook.active} playbooks={playbooks} />
      ))}
    </div>
  );
}

interface CardProps {
  initial: Draft;
  playbooks: PlaybookView[];
  /** Só playbooks já criados. */
  active?: boolean;
  onDone?: () => void;
}

function PlaybookCard({ initial, playbooks, active, onDone }: CardProps) {
  const [draft, setDraft] = useState(initial);
  const { pending, run } = useSave();
  const toggle = useSave();
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const id = `playbook-${initial.id ?? "novo"}`;
  const isNew = initial.id === null;
  const pendingUrl = draft.linkBase.trim() === "";
  const others = playbooks.filter((playbook) => playbook.id !== initial.id);
  const example = playbookLink({ linkBase: draft.linkBase, linkAppendsSchoolParam: draft.linkAppendsSchoolParam }, EXAMPLE_SCHOOL);

  function toggleSuggestion(playbookId: string, checked: boolean) {
    set("houseSuggestionIds", checked ? [...draft.houseSuggestionIds, playbookId] : draft.houseSuggestionIds.filter((item) => item !== playbookId));
  }

  return (
    <Card variant="static">
      <CardHeading
        icon={BookOpen}
        tone="slate"
        title={isNew ? "Novo playbook" : initial.name}
        action={
          <div className="flex flex-wrap justify-end gap-1.5">
            {pendingUrl ? (
              <Badge variant="outline">
                <AlertTriangle aria-hidden />
                URL pendente
              </Badge>
            ) : null}
            {active === false ? <Badge variant="muted">Inativo</Badge> : null}
          </div>
        }
      />
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id={`${id}-nome`} label="Nome" className="sm:col-span-2">
            <Input id={`${id}-nome`} className="h-11" value={draft.name} onChange={(event) => set("name", event.target.value)} maxLength={80} />
          </FormField>
          <FormField id={`${id}-publico`} label="Público">
            <NativeSelect
              id={`${id}-publico`}
              className="h-11"
              value={draft.audience}
              onChange={(event) => set("audience", event.target.value as Draft["audience"])}
            >
              {AUDIENCES.map((audience) => (
                <option key={audience} value={audience}>
                  {AUDIENCE_LABELS[audience]}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField id={`${id}-cadencia`} label="Tipo de cadência">
            <NativeSelect
              id={`${id}-cadencia`}
              className="h-11"
              value={draft.cadenceType}
              onChange={(event) => set("cadenceType", event.target.value as Draft["cadenceType"])}
            >
              {CADENCE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {CADENCE_TYPE_LABELS[type]}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField id={`${id}-objetivo`} label="Objetivo no CRM" className="sm:col-span-2">
            <NativeSelect
              id={`${id}-objetivo`}
              className="h-11"
              value={draft.crmGoal}
              onChange={(event) => set("crmGoal", event.target.value as Draft["crmGoal"])}
            >
              {PROSPECTION_GOALS.map((goal) => (
                <option key={goal} value={goal}>
                  {PROSPECTION_GOAL_LABELS[goal]}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField id={`${id}-toque0`} label="Toque 0 (achar o decisor)" className="sm:col-span-2">
            <NativeSelect
              id={`${id}-toque0`}
              className="h-11"
              value={draft.touchZeroVariant}
              onChange={(event) => set("touchZeroVariant", event.target.value as Draft["touchZeroVariant"])}
            >
              {TOUCH_ZERO_VARIANTS.map((variant) => (
                <option key={variant} value={variant}>
                  {TOUCH_ZERO_VARIANT_LABELS[variant]}
                </option>
              ))}
            </NativeSelect>
          </FormField>
        </div>

        <div className="space-y-3 rounded-md border border-border p-4">
          <FormField id={`${id}-link`} label="Link {link}" hint={pendingUrl ? "URL pendente: sem link, o envio de toques com {link} fica bloqueado." : undefined}>
            <Input
              id={`${id}-link`}
              className="h-11"
              inputMode="url"
              placeholder="https://www.alemfilmes.com.br/…"
              value={draft.linkBase}
              onChange={(event) => set("linkBase", event.target.value)}
              aria-describedby={`${id}-link-message`}
            />
          </FormField>
          <div className="flex min-h-11 items-center gap-3">
            <Switch
              id={`${id}-escola`}
              checked={draft.linkAppendsSchoolParam}
              onCheckedChange={(checked) => set("linkAppendsSchoolParam", checked)}
            />
            <label htmlFor={`${id}-escola`} className="text-sm font-semibold">
              Acrescentar ?escola= com o nome do lead
            </label>
          </div>
          {example ? (
            <p className="break-all text-[13px] text-muted-foreground">
              Exemplo para &quot;{EXAMPLE_SCHOOL}&quot;: <span className="font-mono text-foreground">{example}</span>
            </p>
          ) : null}
        </div>

        <FormField id={`${id}-case`} label="Texto do {case}" hint="Opcional. Entra onde o script usa {case}.">
          <Textarea
            id={`${id}-case`}
            rows={2}
            className="min-h-20"
            value={draft.caseText}
            onChange={(event) => set("caseText", event.target.value)}
            maxLength={500}
            aria-describedby={`${id}-case-message`}
          />
        </FormField>

        <div className="flex min-h-11 items-center gap-3">
          <Switch
            id={`${id}-casa`}
            checked={draft.usesHouseClientScript}
            onCheckedChange={(checked) => set("usesHouseClientScript", checked)}
          />
          <label htmlFor={`${id}-casa`} className="text-sm leading-snug">
            <span className="font-semibold">Usa o script &quot;cliente da casa&quot;</span>
            <span className="block text-[13px] text-muted-foreground">Para quem já é cliente, o primeiro toque é o script de Scripts › Compartilhados.</span>
          </label>
        </div>

        {others.length ? (
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-foreground">Cliente da casa: quem fechou este playbook recebe a sugestão de</legend>
            <ul className="grid gap-1 sm:grid-cols-2">
              {others.map((playbook) => {
                const checkboxId = `${id}-sugere-${playbook.id}`;
                const order = draft.houseSuggestionIds.indexOf(playbook.id);
                return (
                  <li key={playbook.id} className="flex min-h-11 items-center gap-3">
                    <Checkbox
                      id={checkboxId}
                      checked={order >= 0}
                      onCheckedChange={(checked) => toggleSuggestion(playbook.id, checked === true)}
                      className="size-5"
                    />
                    <label htmlFor={checkboxId} className="text-sm">
                      {playbook.name}
                      {order >= 0 ? <span className="text-muted-foreground"> · {order + 1}ª opção</span> : null}
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2">
          {isNew ? (
            <Button type="button" variant="ghost" size="lg" onClick={onDone}>
              Cancelar
            </Button>
          ) : (
            <Button
              type="button"
              variant="secondary"
              size="lg"
              loading={toggle.pending}
              onClick={() => toggle.run(() => setPlaybookActiveAction(initial.id ?? "", !active))}
            >
              <Power aria-hidden />
              {active ? "Desativar" : "Ativar"}
            </Button>
          )}
          <Button
            type="button"
            size="lg"
            loading={pending}
            onClick={() => run(() => savePlaybookAction({ ...draft, caseText: draft.caseText || null }), onDone)}
          >
            <Save aria-hidden />
            {isNew ? "Criar" : "Salvar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
