import { LinkTabs } from "@/components/ui/link-tabs";
import { ScriptEditor } from "@/features/prospeccao/components/script-editor";
import { AUDIENCES, AUDIENCE_LABELS, PROSPECTING_PATH, TOUCH_ZERO_VARIANTS, TOUCH_ZERO_VARIANT_LABELS } from "@/features/prospeccao/labels";
import type { ScriptInput } from "@/features/prospeccao/schemas";
import type { PlaybookView, ProspectingConfig } from "@/features/prospeccao/types";
import { addDays, appZoneToIso, todayInAppZone } from "@/lib/calendar";
import type { RenderContext } from "@/lib/prospeccao/render";
import type { ProspectAudience, ProspectScript, ProspectTouchZeroVariant } from "@/types";

const SAMPLE: Record<ProspectAudience, Omit<RenderContext, "now" | "playbook">> = {
  escola: {
    decisionMakerName: "Mariana Souza",
    leadName: "Colégio Exemplo",
    hook: "vi que vocês abriram a unidade de Parnamirim",
    lastProject: "Fest Show 2026",
  },
  empresa: {
    decisionMakerName: "Rafael Lima",
    leadName: "Empresa Exemplo",
    hook: "vai fazer a convenção anual em novembro",
    lastProject: "filme institucional 2026",
  },
};

const VARIANT_AUDIENCE: Record<ProspectTouchZeroVariant, ProspectAudience> = {
  escola_matricula_recorrente: "escola",
  escola_espetaculos: "escola",
  empresa: "empresa",
};

function toInput(script: ProspectScript): ScriptInput {
  return {
    id: script.id,
    playbookId: script.playbook_id,
    kind: script.kind,
    touchNumber: script.touch_number,
    touchZeroVariant: script.touch_zero_variant,
    audience: script.audience,
    body: script.body,
  };
}

function blank(fields: Omit<ScriptInput, "id" | "body">): ScriptInput {
  return { id: null, body: "", ...fields };
}

interface Props {
  config: ProspectingConfig;
  group: string | undefined;
  nowIso: string;
}

export function ScriptsPanel({ config, group, nowIso }: Props) {
  const playbook = config.playbooks.find((item) => item.slug === group);
  const tabs = [
    { href: `${PROSPECTING_PATH}?aba=scripts`, label: "Compartilhados", active: !playbook },
    ...config.playbooks.map((item) => ({
      href: `${PROSPECTING_PATH}?aba=scripts&grupo=${item.slug}`,
      label: item.active ? item.name : `${item.name} (inativo)`,
      active: item.id === playbook?.id,
    })),
  ];

  return (
    <div className="space-y-6">
      <LinkTabs label="Grupo de scripts" tabs={tabs} tone="neutral" />
      {playbook ? <PlaybookScripts config={config} playbook={playbook} nowIso={nowIso} /> : <SharedScripts config={config} nowIso={nowIso} />}
    </div>
  );
}

function SharedScripts({ config, nowIso }: { config: ProspectingConfig; nowIso: string }) {
  const find = (predicate: (script: ProspectScript) => boolean) => config.scripts.find((script) => script.playbook_id === null && predicate(script));

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Valem para todos os playbooks. O Toque 0 pede o contato do decisor; a versão sem gancho substitui o Toque 1 quando o gancho está vazio; o
        cliente da casa é o Toque 1 de quem já fechou e recebeu a entrega.
      </p>
      {TOUCH_ZERO_VARIANTS.map((variant) => {
        const script = find((item) => item.kind === "toque_zero" && item.touch_zero_variant === variant);
        return (
          <ScriptEditor
            key={script?.id ?? `toque-zero-${variant}`}
            title={`Toque 0 · ${TOUCH_ZERO_VARIANT_LABELS[variant]}`}
            description="Achar o decisor: quando o contato cadastrado é de secretaria ou recepção."
            script={script ? toInput(script) : blank({ playbookId: null, kind: "toque_zero", touchNumber: null, touchZeroVariant: variant, audience: null })}
            sample={SAMPLE[VARIANT_AUDIENCE[variant]]}
            nowIso={nowIso}
          />
        );
      })}
      {AUDIENCES.map((audience) => {
        const script = find((item) => item.kind === "sem_gancho" && item.audience === audience);
        return (
          <ScriptEditor
            key={script?.id ?? `sem-gancho-${audience}`}
            title={`Versão sem gancho · ${AUDIENCE_LABELS[audience]}`}
            description="Substitui o Toque 1 quando o campo gancho do lead está vazio."
            script={script ? toInput(script) : blank({ playbookId: null, kind: "sem_gancho", touchNumber: null, touchZeroVariant: null, audience })}
            sample={{ ...SAMPLE[audience], hook: null }}
            nowIso={nowIso}
          />
        );
      })}
      <MeetingOfferEditor config={config} nowIso={nowIso} />
      {AUDIENCES.map((audience) => {
        const script = find((item) => item.kind === "cliente_da_casa" && item.audience === audience);
        return (
          <ScriptEditor
            key={script?.id ?? `cliente-da-casa-${audience}`}
            title={`Cliente da casa · ${AUDIENCE_LABELS[audience]}`}
            description="Toque 1 de quem já fechou e teve a entrega concluída."
            script={script ? toInput(script) : blank({ playbookId: null, kind: "cliente_da_casa", touchNumber: null, touchZeroVariant: null, audience })}
            sample={SAMPLE[audience]}
            nowIso={nowIso}
          />
        );
      })}
    </div>
  );
}

function PlaybookScripts({ config, playbook, nowIso }: { config: ProspectingConfig; playbook: PlaybookView; nowIso: string }) {
  const cadence = config.cadences.find((item) => item.cadence_type === playbook.cadence_type);
  const offsets = cadence?.touch_offsets ?? [];
  const own = config.scripts.filter((script) => script.playbook_id === playbook.id);
  const touches = own.filter((script) => script.kind === "toque");
  // Toques da cadência atual + os que sobraram de uma cadência mais longa (não são enviados).
  const numbers = [...new Set([...offsets.map((_, index) => index + 1), ...touches.map((script) => script.touch_number ?? 0)])].sort((a, b) => a - b);
  const reactivation = own.find((script) => script.kind === "reativacao");
  const sample = {
    ...SAMPLE[playbook.audience],
    playbook: { linkBase: playbook.link_base, linkAppendsSchoolParam: playbook.link_appends_school_param, caseText: playbook.case_text },
  };
  const last = offsets.length;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Cadência {cadence ? `${cadence.cadence_type === "sazonal" ? "sazonal" : "de relacionamento"}: ${offsets.length} toques, dias úteis ${offsets.join(", ")}` : "não encontrada"}.
        O Toque 1 abre falando do lead e fecha com uma pergunta fácil; o link só entra a partir do Toque 2.
      </p>
      {numbers.map((number) => {
        const script = touches.find((item) => item.touch_number === number);
        const offset = offsets[number - 1];
        const outside = offset === undefined;
        const title = outside
          ? `Toque ${number} · fora da cadência atual`
          : `Toque ${number} · dia ${offset}${number === last && number > 1 ? " (encerramento)" : ""}`;
        return (
          <ScriptEditor
            key={script?.id ?? `toque-${number}`}
            title={title}
            description={outside ? "A cadência tem menos toques: este script não é enviado." : undefined}
            script={script ? toInput(script) : blank({ playbookId: playbook.id, kind: "toque", touchNumber: number, touchZeroVariant: null, audience: null })}
            sample={sample}
            nowIso={nowIso}
          />
        );
      })}
      <ScriptEditor
        key={reactivation?.id ?? "reativacao"}
        title={`Reativação${cadence ? ` · ${cadence.reactivation_days} dias` : ""}`}
        description={
          reactivation?.body.trim()
            ? "Enviado quando o lead volta como Reativar. Pode ficar vazio: aí o lead reativado usa o Toque 1."
            : "Script de reativação não definido — usando Toque 1."
        }
        script={reactivation ? toInput(reactivation) : blank({ playbookId: playbook.id, kind: "reativacao", touchNumber: null, touchZeroVariant: null, audience: null })}
        sample={sample}
        nowIso={nowIso}
        emptyHint="Vazio: o lead reativado recebe o Toque 1 do playbook."
      />
    </div>
  );
}

/** Frase da oferta de horários (Marcar reunião). A prévia usa amanhã às 9h e depois de amanhã às 14h30. */
function MeetingOfferEditor({ config, nowIso }: { config: ProspectingConfig; nowIso: string }) {
  const script = config.scripts.find((item) => item.kind === "oferta_reuniao");
  const today = todayInAppZone(new Date(nowIso));
  return (
    <ScriptEditor
      key={script?.id ?? "oferta-reuniao"}
      title="Oferta de horários · Marcar reunião"
      description="Frase que o Paulo manda com os dois horários livres do Anderson."
      script={script ? toInput(script) : blank({ playbookId: null, kind: "oferta_reuniao", touchNumber: null, touchZeroVariant: null, audience: null })}
      sample={{ ...SAMPLE.escola, slots: [appZoneToIso(addDays(today, 1), "09:00"), appZoneToIso(addDays(today, 2), "14:30")] }}
      nowIso={nowIso}
    />
  );
}
