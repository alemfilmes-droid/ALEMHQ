"use client";

import { useState } from "react";
import { Plus, Power, Save, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeading } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useSave } from "@/features/prospeccao/components/use-save";
import { OBJECTION_ACTIONS, OBJECTION_ACTION_LABELS } from "@/features/prospeccao/labels";
import { saveObjectionAction, setObjectionActiveAction } from "@/features/prospeccao/objection-actions";
import type { ObjectionInput } from "@/features/prospeccao/schemas";
import type { ProspectObjection } from "@/types";

const EMPTY: ObjectionInput = { id: null, shortcut: "/", label: "", responseBody: "", hqAction: "registrar" };

/** Aba Objeções: a mesma lista das respostas rápidas do WhatsApp Business do SDR (fonte única). */
export function ObjectionsPanel({ objections }: { objections: ProspectObjection[] }) {
  const [creating, setCreating] = useState(false);
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Respostas fixas, sem variáveis. Ao mudar uma aqui, atualize também a resposta rápida no WhatsApp Business do celular.
        </p>
        {!creating ? (
          <Button type="button" size="lg" variant="secondary" onClick={() => setCreating(true)}>
            <Plus aria-hidden />
            Nova objeção
          </Button>
        ) : null}
      </div>
      {creating ? <ObjectionCard initial={EMPTY} onDone={() => setCreating(false)} /> : null}
      {objections.map((objection) => (
        <ObjectionCard
          key={objection.id}
          active={objection.active}
          initial={{
            id: objection.id,
            shortcut: objection.shortcut,
            label: objection.label,
            responseBody: objection.response_body,
            hqAction: objection.hq_action,
          }}
        />
      ))}
    </div>
  );
}

function ObjectionCard({ initial, active, onDone }: { initial: ObjectionInput; active?: boolean; onDone?: () => void }) {
  const [draft, setDraft] = useState(initial);
  const { pending, run } = useSave();
  const toggle = useSave();
  const set = <K extends keyof ObjectionInput>(key: K, value: ObjectionInput[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const id = `objecao-${initial.id ?? "nova"}`;
  const isNew = initial.id === null;

  return (
    <Card variant="static">
      <CardHeading
        icon={Shield}
        tone="slate"
        title={isNew ? "Nova objeção" : <span className="font-mono">{initial.shortcut}</span>}
        action={active === false ? <Badge variant="muted">Inativa</Badge> : null}
      />
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[12rem_minmax(0,1fr)]">
          <FormField id={`${id}-atalho`} label="Atalho">
            <Input id={`${id}-atalho`} className="h-11 font-mono" value={draft.shortcut} onChange={(event) => set("shortcut", event.target.value)} maxLength={40} />
          </FormField>
          <FormField id={`${id}-objecao`} label="Objeção">
            <Input id={`${id}-objecao`} className="h-11" value={draft.label} onChange={(event) => set("label", event.target.value)} maxLength={120} />
          </FormField>
        </div>
        <FormField id={`${id}-resposta`} label="Resposta">
          <Textarea
            id={`${id}-resposta`}
            rows={4}
            className="text-[15px] leading-relaxed"
            value={draft.responseBody}
            onChange={(event) => set("responseBody", event.target.value)}
            maxLength={2000}
          />
        </FormField>
        <FormField id={`${id}-acao`} label="Ação no HQ">
          <NativeSelect
            id={`${id}-acao`}
            className="h-11"
            value={draft.hqAction}
            onChange={(event) => set("hqAction", event.target.value as ObjectionInput["hqAction"])}
          >
            {OBJECTION_ACTIONS.map((action) => (
              <option key={action} value={action}>
                {OBJECTION_ACTION_LABELS[action]}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <div className="flex flex-wrap justify-end gap-2">
          {isNew ? (
            <Button type="button" variant="ghost" size="lg" onClick={onDone}>
              Cancelar
            </Button>
          ) : (
            <>
              <CopyButton value={draft.responseBody} label="Copiar resposta" size="lg" />
              <Button
                type="button"
                variant="secondary"
                size="lg"
                loading={toggle.pending}
                onClick={() => toggle.run(() => setObjectionActiveAction(initial.id ?? "", !active))}
              >
                <Power aria-hidden />
                {active ? "Desativar" : "Ativar"}
              </Button>
            </>
          )}
          <Button type="button" size="lg" loading={pending} onClick={() => run(() => saveObjectionAction(draft), onDone)}>
            <Save aria-hidden />
            {isNew ? "Criar" : "Salvar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
