"use client";

import { useRef, useState } from "react";
import { Eye, Save } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useSave } from "@/features/prospeccao/components/use-save";
import { WhatsAppBubble } from "@/features/prospeccao/components/whatsapp-bubble";
import { VARIABLE_HINTS } from "@/features/prospeccao/labels";
import type { ScriptInput } from "@/features/prospeccao/schemas";
import { saveScriptAction } from "@/features/prospeccao/script-actions";
import { renderScript, SCRIPT_VARIABLES, type RenderContext, type ScriptVariable } from "@/lib/prospeccao/render";

interface ScriptEditorProps {
  title: string;
  description?: string;
  script: ScriptInput;
  /** Dados de exemplo da prévia (o `now` vem do servidor para a prévia não divergir na hidratação). */
  sample: Omit<RenderContext, "now">;
  nowIso: string;
  /** Texto mostrado quando o corpo está vazio e isso é permitido (reativação ainda não escrita). */
  emptyHint?: string;
}

/**
 * Editor de um script: texto com quebras de linha, variáveis clicáveis e prévia em balão. Quem usa
 * passa `key` com o id do script, para remontar quando um script novo ganha id depois de salvo.
 */
export function ScriptEditor({ title, description, script, sample, nowIso, emptyHint }: ScriptEditorProps) {
  const [body, setBody] = useState(script.body);
  const [saved, setSaved] = useState(script.body);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { pending, run } = useSave();
  const fieldId = `script-${script.kind}-${script.playbookId ?? "geral"}-${script.touchNumber ?? script.touchZeroVariant ?? script.audience ?? "x"}`;

  const preview = renderScript(body, { ...sample, now: new Date(nowIso) });
  const dirty = body !== saved;
  const isNew = script.id === null;

  function insertVariable(variable: ScriptVariable) {
    const token = `{${variable}}`;
    const element = textareaRef.current;
    const start = element?.selectionStart ?? body.length;
    const end = element?.selectionEnd ?? body.length;
    setBody(body.slice(0, start) + token + body.slice(end));
    requestAnimationFrame(() => {
      element?.focus();
      element?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  function save() {
    run(
      () => saveScriptAction({ ...script, body }),
      () => setSaved(body),
    );
  }

  return (
    <Card variant="static">
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <h3 className="text-base font-bold text-foreground">{title}</h3>
            {description ? <p className="text-[13px] text-muted-foreground">{description}</p> : null}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {isNew ? <Badge variant="muted">Ainda não escrito</Badge> : null}
            {dirty ? <Badge variant="outline">Não salvo</Badge> : null}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="min-w-0 space-y-3">
            <label htmlFor={fieldId} className="sr-only">
              Texto do script
            </label>
            <Textarea
              ref={textareaRef}
              id={fieldId}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={7}
              className="min-h-40 text-[15px] leading-relaxed"
              aria-describedby={`${fieldId}-vars`}
            />
            <div id={`${fieldId}-vars`} className="space-y-1.5">
              <p className="text-[13px] font-semibold text-muted-foreground">Variáveis (clique para inserir)</p>
              <ul className="flex flex-wrap gap-1.5">
                {SCRIPT_VARIABLES.map((variable) => (
                  <li key={variable}>
                    <button
                      type="button"
                      onClick={() => insertVariable(variable)}
                      title={VARIABLE_HINTS[variable]}
                      className="min-h-11 rounded-md border border-border-strong bg-surface-raised px-3 font-mono text-[13px] text-foreground transition-colors hover:bg-surface-hover"
                    >
                      {`{${variable}}`}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="min-w-0 space-y-2">
            <p className="flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground">
              <Eye className="size-3.5" aria-hidden />
              Pré-visualizar (dados de exemplo)
            </p>
            <WhatsAppBubble text={preview.text} emptyLabel={emptyHint ?? "Sem texto."} />
            {preview.missing.length ? (
              <p className="text-[13px] text-muted-foreground">
                Sem valor no exemplo: {preview.missing.map((name) => `{${name}}`).join(", ")}.
              </p>
            ) : null}
          </div>
        </div>

        {preview.unknown.length ? (
          <Alert variant="info" title="Variável desconhecida">
            {preview.unknown.map((name) => `{${name}}`).join(", ")} não existe. Confira a digitação — dá para salvar mesmo assim.
          </Alert>
        ) : null}

        <div className="flex justify-end">
          <Button type="button" size="lg" onClick={save} loading={pending} disabled={!dirty || pending}>
            <Save aria-hidden />
            Salvar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
