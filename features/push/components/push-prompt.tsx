"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { PushSettings } from "@/features/push/components/push-settings";
import { getPushSupport, isStandalone } from "@/features/push/client";

const DISMISS_KEY = "alem:push-prompt-dismissed";

/**
 * Convite discreto no app instalado (Tela de Início) enquanto este aparelho ainda não decidiu sobre
 * as notificações. Fechar esconde neste aparelho; dá para ativar depois em Perfil.
 */
export function PushPrompt() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = window.localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      dismissed = false;
    }
    setVisible(!dismissed && isStandalone() && getPushSupport() === "supported" && Notification.permission === "default");
  }, []);

  function dismiss() {
    setVisible(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // sem armazenamento: some só nesta visita
    }
  }

  if (!visible) return null;

  return (
    <div role="region" aria-label="Notificações no celular" className="mb-6 flex items-start gap-3 rounded-lg border border-border bg-surface-raised p-4">
      <div className="min-w-0 flex-1">
        <PushSettings compact onDone={() => setVisible(false)} />
      </div>
      <button type="button" onClick={dismiss} className="rounded-sm p-1 text-subtle hover:text-foreground" aria-label="Agora não">
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
