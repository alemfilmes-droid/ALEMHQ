import type { Metadata } from "next";
import { Bell, CalendarSync, Lock } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Configurações" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader panel="/configuracoes" title="Configurações." />
      <div className="grid max-w-3xl gap-4">
        <Card>
          <CardHeader className="flex-row items-start gap-4 space-y-0">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border-strong bg-surface-raised">
              <Bell className="size-4 text-muted-foreground" aria-hidden />
            </span>
            <div className="flex-1 space-y-1.5">
              <CardTitle>Notificações</CardTitle>
              <CardDescription>Escolha quando e como receber avisos.</CardDescription>
            </div>
            <Badge variant="muted">Em breve</Badge>
          </CardHeader>
        </Card>

        {/*
          Reservado para a sincronização com o Google Agenda, que será ligada DEPOIS da publicação do
          sistema (o OAuth exige o domínio de produção). O banco já tem as colunas (commitments.
          google_event_id, google_calendar_id, google_sync_status) — nenhum código de OAuth existe ainda.
        */}
        <section
          aria-labelledby="google-agenda-title"
          className="rounded-lg border border-dashed border-border-strong bg-surface p-6 opacity-70"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border-strong bg-surface-raised">
              <CalendarSync className="size-4 text-muted-foreground" aria-hidden />
            </span>
            <div className="flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="google-agenda-title" className="section-title">
                  Google Agenda — conectar
                </h2>
                <Badge variant="outline">Disponível após a publicação do sistema</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Cada pessoa vai conectar a própria conta Google. Os compromissos do Além HQ (reuniões, captações, entregas e pautas agendadas) passam
                a aparecer na sua agenda do Google, e as mudanças feitas lá voltam para cá.
              </p>
              <ul className="list-disc space-y-1 pl-5 text-[13px] text-subtle">
                <li>A conexão é individual: ninguém conecta a conta de outra pessoa.</li>
                <li>Compromissos privados continuam aparecendo como “Ocupado” para o resto da equipe.</li>
                <li>Você pode desconectar a qualquer momento.</li>
              </ul>
            </div>
            <Button variant="secondary" disabled className="shrink-0">
              <Lock aria-hidden />
              Conectar conta Google
            </Button>
          </div>
        </section>
      </div>
    </>
  );
}
