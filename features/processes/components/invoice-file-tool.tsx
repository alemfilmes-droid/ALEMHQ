"use client";

import { useState } from "react";
import { InvoiceFilePreview } from "@/components/drive/invoice-file-preview";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { SearchSelect } from "@/components/ui/search-select";
import { buildInvoiceFile } from "@/lib/invoice-file";
import { todayInAppZone } from "@/lib/calendar";

export interface InvoiceReceivableOption {
  id: string;
  label: string;
  clientName: string;
  /** Competência (ou vencimento), yyyy-mm-dd. */
  month: string;
}

/**
 * Ferramenta do passo "Renomear e salvar o PDF": escolha o recebimento (quem tem financeiro) ou
 * digite cliente e mês, e copie o caminho e o nome do arquivo.
 */
export function InvoiceFileTool({ receivables }: { receivables: InvoiceReceivableOption[] }) {
  const [receivableId, setReceivableId] = useState("");
  const [clientName, setClientName] = useState("");
  const [month, setMonth] = useState(todayInAppZone().slice(0, 7));
  const receivable = receivables.find((item) => item.id === receivableId);
  const file = buildInvoiceFile(receivable ? { clientName: receivable.clientName, month: receivable.month } : { clientName: clientName || "Nome do cliente", month: `${month}-01` });

  return (
    <div className="space-y-3 rounded-md border border-border bg-surface-raised p-3 print:hidden">
      <p className="text-[12px] font-bold text-muted-foreground">Caminho e nome do PDF da nota</p>
      {receivables.length > 0 ? (
        <SearchSelect
          id="invoice-tool-receivable"
          value={receivableId}
          onChange={setReceivableId}
          options={receivables.map((item) => ({ value: item.id, label: item.label }))}
          placeholder="Escolha o recebimento"
          emptyLabel="Nenhum recebimento encontrado."
        />
      ) : null}
      {!receivable ? (
        <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
          <FormField id="invoice-tool-client" label="Cliente">
            <Input id="invoice-tool-client" value={clientName} onChange={(event) => setClientName(event.target.value)} placeholder="Colégio Contemporâneo" />
          </FormField>
          <FormField id="invoice-tool-month" label="Mês">
            <Input id="invoice-tool-month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
          </FormField>
        </div>
      ) : null}
      <InvoiceFilePreview file={file} />
    </div>
  );
}
