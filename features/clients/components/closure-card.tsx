import { ClosureNotice } from "@/features/clients/components/closure-notice";
import type { ClientClosureInfo } from "@/features/clients/closures";

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

/** Encerramento no cliente/projeto: motivo, explicação, potencial, pendências declaradas e o que a cascata fez (sem valores). */
export function ClosureCard({ closure, title = "Encerramento" }: { closure: ClientClosureInfo; title?: string }) {
  const summary = closure.summary;
  return (
    <section aria-labelledby={`closure-${closure.id}`} className="mb-10 space-y-3">
      <h2 id={`closure-${closure.id}`} className="section-title">
        {title}
      </h2>
      <ClosureNotice closure={closure} />
      <ul className="space-y-1 text-[13px] text-muted-foreground">
        {closure.hasPendingReceivables ? <li>Valores ainda a receber{closure.pendingReceivablesNote ? `: ${closure.pendingReceivablesNote}` : "."}</li> : <li>Sem valores a receber declarados.</li>}
        {closure.hasPendingPayables ? <li>Custos ainda a pagar{closure.pendingPayablesNote ? `: ${closure.pendingPayablesNote}` : "."}</li> : <li>Sem custos a pagar declarados.</li>}
        {closure.notes ? <li>Observações: {closure.notes}</li> : null}
        {summary ? (
          <li>
            Na data: {plural(summary.projects, "projeto encerrado", "projetos encerrados")}, {plural(summary.pautas, "pauta encerrada", "pautas encerradas")},{" "}
            {plural(summary.receivablesCancelled, "recebimento cancelado", "recebimentos cancelados")} ({summary.receivablesKept} mantidos),{" "}
            {plural(summary.payablesCancelled, "pagamento cancelado", "pagamentos cancelados")} ({summary.payablesKept} mantidos).
          </li>
        ) : null}
      </ul>
    </section>
  );
}
