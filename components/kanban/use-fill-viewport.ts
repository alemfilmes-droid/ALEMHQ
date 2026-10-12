"use client";

import { useEffect, useRef } from "react";

/** A partir de qual largura o quadro ocupa exatamente o resto da tela (no celular continua como era). */
const DESKTOP_MIN = 1024;

/**
 * Quadro que preenche a altura da tela no computador: mede onde ele começa e usa o resto da janela
 * (menos `bottomGap`: o respiro de baixo do <main>, py-10), em vez de um cálculo fixo que não batia com o cabeçalho e fazia a página rolar
 * junto com as colunas. Recalcula ao redimensionar.
 */
export function useFillViewport<T extends HTMLElement>(bottomGap = 40) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    function fit() {
      if (!element) return;
      if (window.innerWidth < DESKTOP_MIN) {
        element.style.height = "";
        return;
      }
      const top = element.getBoundingClientRect().top + window.scrollY;
      element.style.height = `${Math.max(420, window.innerHeight - top - bottomGap)}px`;
    }
    fit();
    const frame = requestAnimationFrame(fit);
    window.addEventListener("resize", fit);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", fit);
    };
  }, [bottomGap]);

  return ref;
}
