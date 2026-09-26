"use client";

import { createContext, useCallback, useContext, useEffect, useState, type MouseEvent, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Modo privacidade — conveniência de TELA para quem já pode ver os valores (mostrar o sistema a
 * alguém sem expor números). Nunca substitui o controle de acesso: quem não tem acesso ao financeiro
 * não recebe os valores do servidor.
 *
 * Como funciona: o estado vira `data-privacy="on"` no <html>; o CSS (app/globals.css, bloco
 * "Modo privacidade") troca todo elemento com `data-sensitive` por "R$ ••••••" e esconde números de
 * eixos e tooltips dos gráficos. Persiste por navegador (localStorage) e o script PRIVACY_BOOT_SCRIPT
 * aplica antes da primeira pintura, sem piscar os valores.
 */

export const PRIVACY_STORAGE_KEY = "alem-hq:privacy";

/** Roda no <head>, antes da hidratação: evita mostrar os valores por um instante ao recarregar. */
export const PRIVACY_BOOT_SCRIPT = `try{if(localStorage.getItem("${PRIVACY_STORAGE_KEY}")==="on")document.documentElement.dataset.privacy="on"}catch(e){}`;

interface PrivacyContextValue {
  enabled: boolean;
  toggle: () => void;
}

const PrivacyContext = createContext<PrivacyContextValue>({ enabled: false, toggle: () => {} });

export function usePrivacyMode() {
  return useContext(PrivacyContext);
}

function apply(enabled: boolean) {
  if (enabled) document.documentElement.dataset.privacy = "on";
  else delete document.documentElement.dataset.privacy;
  try {
    localStorage.setItem(PRIVACY_STORAGE_KEY, enabled ? "on" : "off");
  } catch {
    // Armazenamento indisponível: vale só para esta página.
  }
}

/** Atalho: Alt+Shift+H (⌥⇧H no Mac). */
function isShortcut(event: KeyboardEvent) {
  return event.altKey && event.shiftKey && !event.metaKey && !event.ctrlKey && event.code === "KeyH";
}

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(document.documentElement.dataset.privacy === "on");
  }, []);

  const toggle = useCallback(() => {
    setEnabled((current) => {
      apply(!current);
      return !current;
    });
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!isShortcut(event)) return;
      event.preventDefault();
      toggle();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  return <PrivacyContext.Provider value={{ enabled, toggle }}>{children}</PrivacyContext.Provider>;
}

/** Olho da barra superior: liga/desliga o modo privacidade em todo o sistema. */
export function PrivacyToggle() {
  const { enabled, toggle } = usePrivacyMode();
  const label = enabled ? "Mostrar valores (Alt+Shift+H)" : "Ocultar valores — modo privacidade (Alt+Shift+H)";
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-pressed={enabled}
      aria-label={label}
      title={label}
      className={cn(enabled && "text-brand-accent hover:text-brand-accent")}
    >
      {enabled ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
    </Button>
  );
}

/**
 * Olho de um card: vale só para o card (o contêiner com `data-privacy-scope`, ou o `.card-surface`). Com o modo global
 * desligado, esconde os valores deste card; com ele ligado, mostra só este card.
 */
export function PrivacyCardToggle({ className }: { className?: string }) {
  const { enabled } = usePrivacyMode();
  const [override, setOverride] = useState<"hidden" | "shown" | null>(null);

  // O override faz sentido em relação ao modo global — ao trocar o global, volta ao padrão.
  useEffect(() => {
    setOverride(null);
  }, [enabled]);

  const masked = override === "hidden" || (enabled && override !== "shown");

  function onClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    // O card: o contêiner marcado com data-privacy-scope ou, na falta dele, a superfície do card.
    const scope = event.currentTarget.closest<HTMLElement>("[data-privacy-scope], .card-surface");
    const next = masked ? (enabled ? "shown" : null) : enabled ? null : "hidden";
    setOverride(next);
    if (!scope) return;
    if (next) scope.dataset.privacyCard = next;
    else delete scope.dataset.privacyCard;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={masked}
      aria-label={masked ? "Mostrar valores deste card" : "Ocultar valores deste card"}
      title={masked ? "Mostrar valores deste card" : "Ocultar valores deste card"}
      className={cn("rounded-sm p-1 text-subtle transition-colors hover:bg-surface-hover hover:text-foreground", className)}
    >
      {masked ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
    </button>
  );
}
