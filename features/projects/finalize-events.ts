/**
 * Pede ao app para conferir se um projeto ficou pronto para finalizar (depois de dar baixa num
 * recebimento ou aprovar uma pauta). O ProjectFinalizeWatcher, montado no layout, escuta e abre o
 * pop-up de confirmação quando for o caso.
 */
export const PROJECT_CHECK_EVENT = "alem:project-check";

export function requestProjectFinalizeCheck(projectId: string | null | undefined) {
  if (!projectId || typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<string>(PROJECT_CHECK_EVENT, { detail: projectId }));
}
