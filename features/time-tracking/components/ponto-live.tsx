"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TimerActions } from "@/features/time-tracking/components/timer-actions";
import { formatMinutes } from "@/features/time-tracking/format";
import { toneColor } from "@/lib/status";
import { cn } from "@/lib/utils";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function formatHms(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
}

/** Escala visual da barra: 100% da meta ocupa 100/SCALE da largura, sobrando espaço pro excedente. */
const SCALE = 150;

interface PontoLiveProps {
  /** Segundos já fechados hoje (pares completos) — vem do servidor, nunca de um contador só do cliente. */
  closedSecondsToday: number;
  /** ISO da entrada em aberto, ou nulo. Toda vez que muda (pausar/retomar), a contagem ao vivo reinicia daqui. */
  openStartedAt: string | null;
  hasEntriesToday: boolean;
  dailyMinutes: number;
}

/**
 * Painel ao vivo do "Ponto do dia": relógio, bolinha de status, ações e barra de progresso — tudo
 * derivado de UM único valor (segundos fechados + decorrido desde a entrada aberta), recalculado a
 * cada segundo e sempre que os dados do servidor mudam (pausar/retomar troca `openStartedAt` e
 * `closedSecondsToday` juntos, então a exibição continua do total acumulado, sem voltar a zero).
 */
export function PontoLive({ closedSecondsToday, openStartedAt, hasEntriesToday, dailyMinutes }: PontoLiveProps) {
  const router = useRouter();
  const isOpen = Boolean(openStartedAt);
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (!openStartedAt) {
      setElapsedMs(0);
      return;
    }
    const startedAtMs = new Date(openStartedAt).getTime();
    function tick() {
      setElapsedMs(Date.now() - startedAtMs);
    }
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [openStartedAt]);

  // Reabrir a aba (ou voltar de outra) revalida os dados do servidor — cobre pausar/encerrar em outro dispositivo.
  useEffect(() => {
    function onFocus() {
      router.refresh();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [router]);

  const liveSeconds = closedSecondsToday + (isOpen ? elapsedMs / 1000 : 0);
  const liveMinutes = liveSeconds / 60;
  const reachedTarget = dailyMinutes > 0 && liveMinutes >= dailyMinutes;
  const showClosedCaption = !isOpen && hasEntriesToday;

  const dotTone = isOpen ? "success" : hasEntriesToday ? "warning" : "neutral";
  const digitsColor = isOpen ? toneColor("success") : undefined;

  const pct = dailyMinutes > 0 ? (liveMinutes / dailyMinutes) * 100 : 0;
  const basePct = Math.min(pct, 100);
  const overflowPct = Math.max(0, Math.min(pct, SCALE) - basePct);
  const baseWidth = (basePct / SCALE) * 100;
  const overflowWidth = (overflowPct / SCALE) * 100;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden
          className={cn("inline-block size-2.5 shrink-0 rounded-full", isOpen && "animate-pulse")}
          style={{ background: toneColor(dotTone) ?? "var(--subtle)" }}
        />
        <p
          className="font-display text-5xl font-black tracking-tight tabular-nums sm:text-6xl"
          style={digitsColor ? { color: digitsColor } : undefined}
        >
          {formatHms(liveSeconds)}
        </p>
      </div>

      <TimerActions isOpen={isOpen} hasEntriesToday={hasEntriesToday} />

      <div>
        {showClosedCaption ? (
          reachedTarget ? (
            <p className="text-xs font-semibold" style={{ color: toneColor("success") }}>
              Meta diária concluída
            </p>
          ) : (
            <p className="text-xs font-semibold" style={{ color: toneColor("danger") }}>
              Faltam {formatMinutes(dailyMinutes - liveMinutes)}
            </p>
          )
        ) : (
          <p className="text-xs text-subtle">
            Horas hoje: {formatMinutes(liveMinutes)} de {formatMinutes(dailyMinutes)}
          </p>
        )}

        <div className="relative mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-hover">
          <div
            className="absolute inset-y-0 left-0 h-full rounded-full transition-[width] duration-700 ease-linear"
            style={{ width: `${baseWidth}%`, background: reachedTarget ? toneColor("success") : toneColor("danger") }}
          />
          <div
            className="absolute inset-y-0 h-full rounded-full opacity-60 transition-[width] duration-700 ease-linear"
            style={{ left: `${baseWidth}%`, width: `${overflowWidth}%`, background: toneColor("success") }}
          />
        </div>
      </div>
    </div>
  );
}
