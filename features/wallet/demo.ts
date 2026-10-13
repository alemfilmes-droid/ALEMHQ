import "server-only";
import type { WalletPage } from "@/features/wallet/queries";
import { addDays, addMonths } from "@/lib/calendar";
import type { LedgerEvent } from "@/lib/wallet/ledger";
import { buildWallet, type Remuneration, type WalletEntry } from "@/lib/wallet/wallet";

/**
 * Carteira de demonstração para conferir a tela no servidor local (`npm run dev` + `/carteira?demo=1`).
 * Nada é lido nem gravado no banco: datas relativas a hoje.
 */

const at = (day: string, time: string) => new Date(`${day}T${time}:00-03:00`).toISOString();

export function demoWallet(person: { id: string; name: string }, today: string): WalletPage {
  const month = `${today.slice(0, 7)}`;
  const day = (offsetMonths: number, dayOfMonth: number) => `${addMonths(`${month}-01`, offsetMonths).slice(0, 7)}-${String(dayOfMonth).padStart(2, "0")}`;
  const remuneration: Remuneration = { type: "fixo_mais_variavel", fixedAmountCents: 350_000, payday: 10, defaultCommissionPercent: 5 };

  const base = { companyName: null, projectName: null, goalTitle: null, teamType: "pagamento_colaborador" as const, category: "pessoal", isFixed: false, hasGoal: false, hasProject: false };
  const entries: WalletEntry[] = [
    { ...base, id: "d1", description: "Comissão · contrato anual", amountCents: 84_000, dueDate: addDays(today, -6), payoutDate: day(1, 10), paidAt: null, companyName: "Clínica Aurora", teamType: "comissao", createdAt: at(addDays(today, -9), "09:12") },
    { ...base, id: "d2", description: "Cachê · captação do evento", amountCents: 65_000, dueDate: addDays(today, 3), payoutDate: day(1, 10), paidAt: null, companyName: "Waves Café", projectName: "Evento de inauguração", hasProject: true, createdAt: at(addDays(today, -4), "16:40") },
    { ...base, id: "d3", description: "Bônus da meta do trimestre", amountCents: 120_000, dueDate: day(1, 28), payoutDate: day(2, 10), paidAt: null, goalTitle: "Meta Q4", teamType: "comissao", hasGoal: true, createdAt: at(addDays(today, -2), "11:05") },
  ];

  const ev = (overrides: Partial<LedgerEvent> & Pick<LedgerEvent, "id" | "payableId" | "amountCents" | "occurredAt" | "paidOn" | "description">): LedgerEvent => ({
    kind: "payout",
    timeRecorded: true,
    actorName: "Anna (Financeiro)",
    reversesEventId: null,
    companyName: null,
    projectName: null,
    goalTitle: null,
    category: "pessoal",
    teamType: "pagamento_colaborador",
    isFixed: false,
    hasGoal: false,
    hasProject: false,
    dueDate: null,
    payoutDate: null,
    entryCreatedAt: null,
    ...overrides,
  });
  const ledger: LedgerEvent[] = [
    ev({ id: "l1", payableId: "p1", description: "Fixo do mês", amountCents: 350_000, paidOn: day(0, 10), occurredAt: at(day(0, 10), "14:22"), isFixed: true, dueDate: day(0, 5), payoutDate: day(0, 10), entryCreatedAt: at(day(0, 1), "08:30") }),
    ev({ id: "l2", payableId: "p2", description: "Comissão · pacote de vídeos", amountCents: 42_500, paidOn: day(0, 10), occurredAt: at(day(0, 10), "14:25"), companyName: "Clínica Aurora", teamType: "comissao", dueDate: day(0, 2), payoutDate: day(0, 10), entryCreatedAt: at(day(-1, 28), "10:00") }),
    ev({ id: "l3", payableId: "p3", description: "Cachê · ensaio de produto", amountCents: 30_000, paidOn: day(0, 10), occurredAt: at(day(0, 10), "14:30"), companyName: "Waves Café", projectName: "Cardápio de verão", hasProject: true, dueDate: day(0, 3), payoutDate: day(0, 10), entryCreatedAt: at(day(-1, 30), "15:10") }),
    ev({ id: "l4", payableId: "p3", kind: "reversal", reversesEventId: "l3", description: "Cachê · ensaio de produto", amountCents: 30_000, paidOn: day(0, 10), occurredAt: at(day(0, 11), "09:03"), companyName: "Waves Café", projectName: "Cardápio de verão", hasProject: true, dueDate: day(0, 3), payoutDate: day(0, 10), entryCreatedAt: at(day(-1, 30), "15:10") }),
    ev({ id: "l5", payableId: "p4", description: "Fixo do mês", amountCents: 350_000, paidOn: day(-1, 10), occurredAt: at(day(-1, 10), "12:00"), timeRecorded: false, actorName: null, isFixed: true, dueDate: day(-1, 5), payoutDate: day(-1, 10) }),
  ];

  return {
    person,
    remuneration,
    view: buildWallet(entries, remuneration, today),
    ledger,
    today,
    people: [person, { id: "demo-2", name: "Pessoa de exemplo" }],
  };
}
