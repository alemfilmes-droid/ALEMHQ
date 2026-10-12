"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { celebrationSeenAction, nextCelebrationAction, type Celebration } from "@/features/goals/celebration-actions";
import { celebrationText, confettiPieces, shouldAnimateConfetti } from "@/lib/goals/celebration";

const CONFETTI_COUNT = 140;
const CONFETTI_MS = 4500;

/** Confete em canvas, atrás do cartão. Sem biblioteca; para sozinho em ~4,5 s. */
function Confetti() {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext("2d");
    if (!element || !context) return;
    const resize = () => {
      element.width = window.innerWidth;
      element.height = window.innerHeight;
    };
    resize();
    const pieces = confettiPieces(CONFETTI_COUNT, element.width);
    const started = performance.now();
    let frame = 0;
    const draw = (now: number) => {
      context.clearRect(0, 0, element.width, element.height);
      for (const piece of pieces) {
        piece.x += piece.vx;
        piece.y += piece.vy;
        piece.spin += 0.1;
        context.save();
        context.translate(piece.x, piece.y);
        context.rotate(piece.spin);
        context.fillStyle = piece.color;
        context.fillRect(-piece.size / 2, -piece.size / 4, piece.size, piece.size / 2);
        context.restore();
      }
      if (now - started < CONFETTI_MS) frame = requestAnimationFrame(draw);
      else context.clearRect(0, 0, element.width, element.height);
    };
    frame = requestAnimationFrame(draw);
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvas} aria-hidden className="pointer-events-none absolute inset-0" />;
}

/**
 * Popup "Parabéns, [nome]! Você ganhou R$ X de comissão" — aparece uma vez por comissão, na próxima tela que a
 * pessoa abrir. Só informa: um botão "Fechar". Respeita "reduzir movimento" (sem confete).
 */
export function CommissionCelebration() {
  const pathname = usePathname();
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const [animate, setAnimate] = useState(false);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let active = true;
    nextCelebrationAction()
      .then((next) => {
        if (!active || !next) return;
        setAnimate(shouldAnimateConfetti(window.matchMedia("(prefers-reduced-motion: reduce)").matches));
        setCelebration(next);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [pathname]);

  useEffect(() => {
    if (!celebration) return;
    closeButton.current?.focus();
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fecha a comemoração aberta
  }, [celebration]);

  function close() {
    if (!celebration) return;
    void celebrationSeenAction(celebration.id).catch(() => undefined);
    setCelebration(null);
  }

  if (!celebration) return null;
  const text = celebrationText(celebration.fullName, celebration.amount, celebration.goalTitle);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="celebration-title" className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4">
      {animate ? <Confetti /> : null}
      <div className="relative z-10 w-full max-w-sm space-y-4 rounded-xl border border-border-strong bg-[#0A0A0A] p-6 text-center shadow-2xl">
        <PartyPopper className="mx-auto size-10 text-[#F0F0F0]" aria-hidden />
        <h2 id="celebration-title" className="font-display text-4xl font-black tracking-tight text-[#F0F0F0]">
          {text.title}
        </h2>
        <p className="text-lg font-semibold text-[#F0F0F0]">{text.amount}</p>
        {text.goal ? <p className="text-sm text-[#BDBDBD]">{text.goal}</p> : null}
        <Button ref={closeButton} type="button" size="lg" className="w-full" onClick={close}>
          Fechar
        </Button>
      </div>
    </div>
  );
}
