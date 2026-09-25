"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const FORTALEZA_OFFSET = "-03:00";

function msUntilNextMidnight(): number {
  const now = new Date();
  const todayLocal = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza" }).format(now);
  const nextMidnight = new Date(new Date(`${todayLocal}T00:00:00${FORTALEZA_OFFSET}`).getTime() + 24 * 60 * 60 * 1000);
  return Math.max(1000, nextMidnight.getTime() - now.getTime());
}

/**
 * Componente invisível: revalida a página exatamente na virada do dia (o card de "Hoje" do
 * extrato aparece sozinho, sem F5) e também ao voltar o foco pra aba — cobre quem deixa a aba
 * aberta durante a noite ou muda de dispositivo no meio do dia.
 */
export function AutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    function scheduleMidnightRefresh() {
      timeout = setTimeout(() => {
        router.refresh();
        scheduleMidnightRefresh();
      }, msUntilNextMidnight());
    }
    scheduleMidnightRefresh();
    return () => clearTimeout(timeout);
  }, [router]);

  useEffect(() => {
    function onFocus() {
      router.refresh();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [router]);

  return null;
}
