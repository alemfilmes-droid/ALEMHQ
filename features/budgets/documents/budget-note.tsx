import { brl, computeBudget, pctNumber, SECTION_LABELS, type BudgetSection } from "@/features/budgets/pricing";
import type { BudgetRecord, ProposalProfile } from "@/features/budgets/types";

function date(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
}

function quantity(value: number) {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

/**
 * Nota de orçamento (visão do cliente): IDV da Além, itens com quantidade e valor, total, condições
 * e validade, além das entregas para o cliente conferir. Mostra valor do serviço, imposto e valor
 * final; nunca custos internos ou margem.
 */
export function BudgetNote({ budget, profile }: { budget: BudgetRecord; profile: ProposalProfile }) {
  const { lines, totals } = computeBudget(budget.items, budget.feePct, budget.taxPct);
  const sections: BudgetSection[] = ["profissional", "custo"];
  const accent = "#E5231B";
  const logo = budget.presentation.clientLogoUrl || budget.companyLogoUrl;

  return (
    <article className="budget-note mx-auto my-8 w-full max-w-[210mm] bg-white text-[#141414] shadow-2xl print:my-0 print:shadow-none">
      <header className="flex items-end justify-between gap-6 bg-[#0A0A0A] px-12 pb-8 pt-10 text-white">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element -- logo da marca no documento impresso */}
          <img src="/brand/alem-filmes_texto-branco.png" alt="Além Filmes" className="h-auto w-44" />
          <p className="mt-3 text-[11px] uppercase tracking-[0.25em] text-white/60">{profile.tagline}</p>
        </div>
        <div className="text-right">
          <p className="font-display text-3xl font-black tracking-tight">Orçamento</p>
          <p className="mt-1 text-sm text-white/70">Nº {String(budget.number).padStart(4, "0")}</p>
        </div>
      </header>
      <div className="h-1" style={{ background: accent }} />

      <section className="grid grid-cols-[1fr_auto] gap-8 px-12 pt-10">
        <div className="space-y-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: accent }}>
            Para
          </p>
          <p className="font-display text-2xl font-black tracking-tight">{budget.clientName}</p>
          <p className="text-base text-[#444]">{budget.title}</p>
        </div>
        <div className="flex items-start gap-6">
          <dl className="space-y-2 text-right text-sm">
            <div>
              <dt className="text-[11px] uppercase tracking-[0.15em] text-[#777]">Emissão</dt>
              <dd className="font-semibold">{date(budget.issueDate)}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-[0.15em] text-[#777]">Válido até</dt>
              <dd className="font-semibold">{date(budget.validUntil)}</dd>
            </div>
          </dl>
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- logo do cliente
            <img src={logo} alt={budget.clientName} className="size-20 rounded-md border border-[#e5e5e5] object-contain p-2" />
          ) : null}
        </div>
      </section>

      <section className="px-12 pt-10">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-[#141414] text-left text-[11px] uppercase tracking-[0.12em] text-[#555]">
              <th className="py-2 font-bold">Item</th>
              <th className="w-16 py-2 text-right font-bold">Qtd</th>
              <th className="w-24 py-2 pl-3 font-bold">Unidade</th>
              <th className="w-32 py-2 text-right font-bold">Valor unit.</th>
              <th className="w-32 py-2 text-right font-bold">Total</th>
            </tr>
          </thead>
          {sections.map((section) => {
            const rows = lines.filter((line) => line.section === section);
            if (rows.length === 0) return null;
            return (
              <tbody key={section} className="break-inside-avoid">
                <tr>
                  <td colSpan={5} className="pb-1 pt-5 text-[11px] font-bold uppercase tracking-[0.15em]" style={{ color: accent }}>
                    {SECTION_LABELS[section]}
                  </td>
                </tr>
                {rows.map((line) => (
                  <tr key={line.id} className="border-b border-[#ececec]">
                    <td className="py-2.5 pr-3 font-medium">{line.description}</td>
                    <td className="py-2.5 text-right tabular-nums">{quantity(line.quantity)}</td>
                    <td className="py-2.5 pl-3 text-[#666]">{line.unit}</td>
                    <td className="py-2.5 text-right tabular-nums">{brl(line.unitPrice)}</td>
                    <td className="py-2.5 text-right font-semibold tabular-nums">{brl(line.price)}</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={4} className="py-2 text-right text-[12px] text-[#777]">
                    Subtotal
                  </td>
                  <td className="py-2 text-right text-[13px] font-semibold tabular-nums">{brl(totals.bySection[section].price)}</td>
                </tr>
              </tbody>
            );
          })}
        </table>

        <div className="mt-8 ml-auto max-w-sm space-y-2 text-sm">
          <div className="flex items-baseline justify-between gap-6">
            <span className="text-[#555]">Valor do serviço</span>
            <span className="font-semibold tabular-nums">{brl(totals.services)}</span>
          </div>
          <div className="flex items-baseline justify-between gap-6">
            <span className="text-[#555]">Imposto ({pctNumber(budget.taxPct)})</span>
            <span className="tabular-nums">{brl(totals.tax)}</span>
          </div>
        </div>
        <div className="mt-4 flex items-end justify-between gap-6 rounded-md bg-[#0A0A0A] px-8 py-6 text-white">
          <p className="text-[11px] uppercase tracking-[0.25em] text-white/60">Valor final para pagamento</p>
          <p className="font-display text-4xl font-black tracking-tight tabular-nums">{brl(totals.final)}</p>
        </div>
      </section>

      {budget.deliverables.length > 0 ? (
        <section className="break-inside-avoid px-12 pt-10">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: accent }}>
            O que você recebe
          </p>
          <ul className="mt-3 grid grid-cols-2 gap-x-10 gap-y-2 text-sm">
            {budget.deliverables.map((item) => (
              <li key={item} className="flex items-start gap-2.5 border-b border-[#ececec] pb-2">
                <span className="mt-[7px] size-1.5 shrink-0 rounded-full" style={{ background: accent }} />
                <span className="text-[#222]">{item}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="grid grid-cols-2 gap-10 px-12 pb-10 pt-10 text-sm">
        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: accent }}>
            Condições
          </p>
          <p className="whitespace-pre-line leading-relaxed text-[#333]">{budget.paymentTerms || "A combinar."}</p>
          <p className="text-[#555]">Proposta válida até {date(budget.validUntil)}.</p>
        </div>
        {budget.notes ? (
          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: accent }}>
              Observações
            </p>
            <p className="whitespace-pre-line leading-relaxed text-[#333]">{budget.notes}</p>
          </div>
        ) : null}
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-[#ececec] px-12 py-6 text-[12px] text-[#666]">
        <span className="font-semibold text-[#141414]">Além Filmes</span>
        <span>{[profile.contactEmail, profile.contactPhone, profile.website, profile.instagram].filter(Boolean).join("  ·  ")}</span>
      </footer>
    </article>
  );
}
