"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Sem dependência de PDF: usa a folha de estilo de impressão do próprio navegador (classes
 * `print:hidden` escondem menu, abas e botões). "Salvar como PDF" no diálogo de impressão do
 * navegador gera o arquivo.
 */
export function ExportPdfButton() {
  return (
    <Button type="button" variant="secondary" size="sm" className="print:hidden" onClick={() => window.print()}>
      <Printer aria-hidden />
      Exportar PDF
    </Button>
  );
}
