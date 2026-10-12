"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LAST_PLACE_KEY, SCROLL_KEY_PREFIX, isResumableRoute, parseSavedPlace, resumeTarget } from "@/lib/resume/place";
import { isStandaloneApp, readStorage, writeStorage } from "@/lib/resume/storage";

/** sessionStorage some quando o iOS fecha o app: a ausência da marca = abertura nova. */
const LAUNCH_MARK = "alem-hq:launched";

/**
 * Invisível, no AppShell. Guarda a tela atual (com filtros da URL) e a rolagem da página; quando o iOS
 * fecha o app e ele reabre no Início, volta para onde a pessoa estava.
 */
export function ResumePlace() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const route = query ? `${pathname}?${query}` : pathname;
  const resuming = useRef<string | null>(null);

  // Abertura: decide uma vez se volta para o lugar salvo.
  useEffect(() => {
    const freshLaunch = readStorage("session", LAUNCH_MARK) === null;
    writeStorage("session", LAUNCH_MARK, "1");
    const target = resumeTarget({
      standalone: isStandaloneApp(),
      freshLaunch,
      pathname: window.location.pathname,
      saved: parseSavedPlace(readStorage("local", LAST_PLACE_KEY)),
      now: Date.now(),
    });
    if (target) {
      resuming.current = target;
      router.replace(target);
    }
    // Só na montagem: é a decisão da abertura.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A cada tela: guarda o lugar e restaura a rolagem quando é a volta de uma reabertura.
  useEffect(() => {
    if (resuming.current && resuming.current !== route) return;
    if (isResumableRoute(route)) writeStorage("local", LAST_PLACE_KEY, JSON.stringify({ route, at: Date.now() }));
    if (resuming.current === route) {
      resuming.current = null;
      const y = Number(readStorage("local", `${SCROLL_KEY_PREFIX}page:${route}`));
      if (y > 0) requestAnimationFrame(() => window.scrollTo(0, y));
    }

    let frame = 0;
    function onScroll() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => writeStorage("local", `${SCROLL_KEY_PREFIX}page:${route}`, String(Math.round(window.scrollY))));
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, [route]);

  return null;
}
