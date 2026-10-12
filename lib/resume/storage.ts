/** Leitura/escrita tolerante: modo privado ou armazenamento bloqueado não quebram a tela. */
export function readStorage(storage: "local" | "session", key: string): string | null {
  try {
    return (storage === "local" ? window.localStorage : window.sessionStorage).getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(storage: "local" | "session", key: string, value: string): void {
  try {
    (storage === "local" ? window.localStorage : window.sessionStorage).setItem(key, value);
  } catch {
    // Sem armazenamento: só não lembra o lugar.
  }
}

/** App aberto pelo ícone da tela de início (iPhone: navigator.standalone; demais: display-mode). */
export function isStandaloneApp(): boolean {
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia("(display-mode: standalone)").matches;
}
