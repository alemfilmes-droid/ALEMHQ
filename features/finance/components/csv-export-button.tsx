"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CsvExportButtonProps {
  filename: string;
  headers: string[];
  rows: string[][];
}

function escapeCell(value: string) {
  // Neutraliza fórmulas em planilhas e escapa aspas.
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** CSV em pt-BR: separador ";" e BOM UTF-8 para o Excel abrir acentos corretamente. */
export function CsvExportButton({ filename, headers, rows }: CsvExportButtonProps) {
  function download() {
    const lines = [headers, ...rows].map((line) => line.map(escapeCell).join(";"));
    const blob = new Blob([`﻿${lines.join("\r\n")}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button type="button" variant="secondary" size="sm" onClick={download} disabled={rows.length === 0}>
      <Download aria-hidden />
      Exportar CSV
    </Button>
  );
}
