"use client";

import { useTransition } from "react";
import { CalendarSync, RefreshCw, Unplug } from "lucide-react";
import { toast } from "sonner";
import { disconnectGoogleAction, syncGoogleNowAction } from "@/features/google/actions";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";

export interface GoogleAccountStatus {
  email: string | null;
  connectedAt: string;
  lastSyncAt: string | null;
  lastError: string | null;
}

const RESULT_MESSAGES: Record<string, { variant: "error" | "success" | "info"; text: string }> = {
  conectado: { variant: "success", text: "Google Agenda conectado. A primeira sincronização já começou." },
  cancelado: { variant: "info", text: "Conexão cancelada no Google." },
  erro: { variant: "error", text: "Não foi possível conectar. Tente de novo; se persistir, avise a diretoria." },
  indisponivel: { variant: "info", text: "A integração ainda não foi configurada pela administração." },
};

/** Conexão da PRÓPRIA conta Google: conectar, sincronizar agora e desconectar. */
export function GoogleCalendarSettings({ account, configured, result }: { account: GoogleAccountStatus | null; configured: boolean; result?: string }) {
  const [pending, startTransition] = useTransition();
  const message = result ? RESULT_MESSAGES[result] : undefined;

  function run(action: () => Promise<{ ok: boolean; message?: string; error?: string }>) {
    startTransition(async () => {
      const response = await action();
      if (response.ok) toast.success(response.message ?? "Pronto.");
      else toast.error(response.error ?? "Algo deu errado.");
    });
  }

  return (
    <section id="google-agenda" aria-labelledby="google-agenda-title" className="scroll-mt-24 rounded-lg border border-border bg-surface p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border-strong bg-surface-raised">
          <CalendarSync className="size-4 text-muted-foreground" aria-hidden />
        </span>
        <div className="flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="google-agenda-title" className="section-title">
              Google Agenda
            </h2>
            {account ? <Badge variant="muted">Conectado</Badge> : <Badge variant="outline">Não conectado</Badge>}
          </div>

          {message ? <Alert variant={message.variant}>{message.text}</Alert> : null}

          {account ? (
            <>
              <p className="text-sm text-muted-foreground">
                Conectado como <span className="font-semibold text-foreground">{account.email ?? "sua conta Google"}</span>. Seus compromissos do Além HQ,
                captações e prazos das suas pautas aparecem na sua agenda do Google (atualiza a cada 15 minutos). Os eventos do seu Google aparecem na
                sua agenda do HQ — só para você.
              </p>
              <p className="text-[12px] text-subtle">
                {account.lastSyncAt ? `Última sincronização: ${formatDateTime(account.lastSyncAt)}` : "Primeira sincronização em andamento."}
              </p>
              {account.lastError ? <Alert variant="error">{account.lastError}</Alert> : null}
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={() => run(syncGoogleNowAction)} loading={pending}>
                  <RefreshCw aria-hidden />
                  Sincronizar agora
                </Button>
                {account.lastError ? (
                  <Button asChild variant="secondary">
                    <a href="/api/google/connect">Conectar de novo</a>
                  </Button>
                ) : null}
                <Button type="button" variant="ghost" onClick={() => run(disconnectGoogleAction)} disabled={pending}>
                  <Unplug aria-hidden />
                  Desconectar
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Conecte a sua conta Google para ver no celular e no Google Agenda tudo o que você tem no HQ: reuniões, captações e prazos das suas
                pautas. Os eventos do seu Google também aparecem na sua agenda do HQ, só para você.
              </p>
              <ul className="list-disc space-y-1 pl-5 text-[13px] text-subtle">
                <li>A conexão é individual: cada pessoa conecta a própria conta.</li>
                <li>Ao desconectar, o HQ apaga do seu Google os eventos que ele criou.</li>
              </ul>
              <Button asChild disabled={!configured}>
                <a href={configured ? "/api/google/connect" : undefined} aria-disabled={!configured}>
                  <CalendarSync aria-hidden />
                  Conectar conta Google
                </a>
              </Button>
              {!configured ? <p className="text-[12px] text-subtle">Aguardando a administração configurar a integração com o Google.</p> : null}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
