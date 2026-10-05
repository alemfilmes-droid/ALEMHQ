import { DRIVE_ROOT } from "@/lib/drive-folder";

/**
 * Onde salvar o PDF de uma nota fiscal emitida e com que nome:
 *
 * ALÉM.FILMES > ADMINISTRATIVO > [02] CONTRATOS E NOTAS FISCAIS > <ano> > Q1|Q2|Q3|Q4 > <MÊS> > <cliente>
 * arquivo: "<ANO> <MÊS> <NOME DO CLIENTE>" (mês com dois dígitos) — ex.: "2026 10 Colégio Contemporâneo".
 *
 * Mês = competência do recebimento (ou o vencimento, quando não houver competência).
 */

const MONTHS = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];

export interface InvoiceFile {
  parents: string[];
  fileName: string;
  fullPath: string;
}

function clean(text: string): string {
  return text.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim();
}

export function buildInvoiceFile({ clientName, month }: { clientName: string; month: string }): InvoiceFile {
  const [year = "", mm = "01"] = month.slice(0, 7).split("-");
  const index = Math.min(Math.max(Number(mm) - 1, 0), 11);
  const client = clean(clientName);
  const parents = [DRIVE_ROOT, "ADMINISTRATIVO", "[02] CONTRATOS E NOTAS FISCAIS", year, `Q${Math.floor(index / 3) + 1}`, MONTHS[index]!, client];
  const fileName = `${year} ${mm} ${client}`;
  return { parents, fileName, fullPath: parents.join(" > ") };
}
