"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Barra só na tela (some na impressão): "Salvar como PDF" usa o diálogo de impressão do navegador. */
export function PrintToolbar({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="print:hidden sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-border bg-background/95 px-5 py-3 backdrop-blur">
      <p className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</p>
      <p className="hidden text-[12px] text-subtle md:block">{hint}</p>
      <Button type="button" onClick={() => window.print()}>
        <Download aria-hidden />
        Salvar como PDF
      </Button>
    </div>
  );
}
