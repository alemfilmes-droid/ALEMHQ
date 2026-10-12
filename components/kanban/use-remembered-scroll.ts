"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { SCROLL_KEY_PREFIX } from "@/lib/resume/place";
import { readStorage, writeStorage } from "@/lib/resume/storage";

/** Rolagem de um elemento (coluna do quadro) lembrada por tela — volta igual depois de reabrir o app. */
export function useRememberedScroll<T extends HTMLElement>(key: string) {
  const pathname = usePathname();
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const storageKey = `${SCROLL_KEY_PREFIX}${pathname}:${key}`;
    const saved = Number(readStorage("local", storageKey));
    if (saved > 0) element.scrollTop = saved;

    let frame = 0;
    function onScroll() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => writeStorage("local", storageKey, String(Math.round(element!.scrollTop))));
    }
    element.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      element.removeEventListener("scroll", onScroll);
    };
  }, [pathname, key]);

  return ref;
}
