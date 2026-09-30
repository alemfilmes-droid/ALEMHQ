"use client";

import { useEffect, useState, useTransition } from "react";
import { BellOff, BellRing, Share, SquarePlus } from "lucide-react";
import { toast } from "sonner";
import { registerPushSubscriptionAction, unregisterPushSubscriptionAction } from "@/features/push/actions";
import { getCurrentSubscription, getPushSupport, subscribeThisDevice, type PushSupport } from "@/features/push/client";
import { Button } from "@/components/ui/button";

type State = "loading" | "on" | "off" | "denied" | PushSupport;

function InstallSteps() {
  return (
    <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
      <li>
        Abra o sistema no <strong className="text-foreground">Safari</strong>.
      </li>
      <li className="flex-wrap">
        Toque em <Share className="inline size-4 align-text-bottom" aria-label="Compartilhar" /> e depois em{" "}
        <SquarePlus className="inline size-4 align-text-bottom" aria-hidden /> <strong className="text-foreground">Adicionar à Tela de Início</strong>.
      </li>
      <li>Abra pelo ícone novo e volte aqui para ativar.</li>
    </ol>
  );
}

/** Ativar/desativar as notificações NESTE aparelho (cada celular/computador ativa o seu). */
export function PushSettings({ compact = false, onDone }: { compact?: boolean; onDone?: () => void }) {
  const [state, setState] = useState<State>("loading");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const support = getPushSupport();
    if (support !== "supported") {
      setState(support);
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    getCurrentSubscription()
      .then((subscription) => setState(subscription && Notification.permission === "granted" ? "on" : "off"))
      .catch(() => setState("off"));
  }, []);

  function enable() {
    startTransition(async () => {
      try {
        const subscription = await subscribeThisDevice();
        if (!subscription) {
          setState(Notification.permission === "denied" ? "denied" : "off");
          return;
        }
        const result = await registerPushSubscriptionAction(subscription.toJSON(), navigator.userAgent);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        setState("on");
        toast.success("Notificações ativadas neste aparelho.");
        onDone?.();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Não foi possível ativar as notificações.");
      }
    });
  }

  function disable() {
    startTransition(async () => {
      const subscription = await getCurrentSubscription().catch(() => null);
      if (subscription) {
        await unregisterPushSubscriptionAction(subscription.endpoint);
        await subscription.unsubscribe().catch(() => undefined);
      }
      setState("off");
      toast.success("Notificações desativadas neste aparelho.");
    });
  }

  if (state === "loading") return null;

  if (state === "needs-install") {
    return (
      <div className="space-y-3">
        <p className="text-sm">No iPhone, as notificações funcionam pelo app instalado na Tela de Início:</p>
        <InstallSteps />
      </div>
    );
  }

  if (state === "unsupported") {
    return <p className="text-sm text-muted-foreground">Este navegador não recebe notificações. No iPhone, use o app da Tela de Início (iOS 16.4 ou mais recente).</p>;
  }

  if (state === "denied") {
    return (
      <p className="text-sm text-muted-foreground">
        As notificações foram bloqueadas neste aparelho. No iPhone: Ajustes → Notificações → Além HQ → Permitir Notificações.
      </p>
    );
  }

  return (
    <div className={compact ? "flex flex-wrap items-center gap-3" : "flex flex-wrap items-center justify-between gap-3"}>
      <p className="text-sm">
        {state === "on" ? "Este aparelho recebe as notificações do sistema." : "Receba no celular as mesmas notificações do sino do sistema."}
      </p>
      {state === "on" ? (
        <Button type="button" variant="secondary" onClick={disable} loading={pending}>
          <BellOff aria-hidden />
          Desativar neste aparelho
        </Button>
      ) : (
        <Button type="button" onClick={enable} loading={pending}>
          <BellRing aria-hidden />
          Ativar notificações
        </Button>
      )}
    </div>
  );
}
