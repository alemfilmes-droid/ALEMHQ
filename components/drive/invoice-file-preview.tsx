import { ChevronRight, FileText, FolderTree } from "lucide-react";
import { CopyButton } from "@/components/ui/copy-button";
import type { InvoiceFile } from "@/lib/invoice-file";

/** Caminho e nome do PDF da nota fiscal, com "Copiar" — para ninguém digitar errado. */
export function InvoiceFilePreview({ file }: { file: InvoiceFile }) {
  return (
    <div className="space-y-2.5">
      <nav aria-label="Pasta da nota no Drive" className="flex flex-wrap items-center gap-1 text-[12px] text-muted-foreground">
        <FolderTree className="mr-1 size-3.5 shrink-0" aria-hidden />
        {file.parents.map((part, index) => (
          <span key={`${part}-${index}`} className="flex items-center gap-1">
            {part}
            {index < file.parents.length - 1 ? <ChevronRight className="size-3 text-subtle" aria-hidden /> : null}
          </span>
        ))}
      </nav>
      <div className="flex flex-wrap items-center gap-2">
        <code className="flex min-w-0 items-center gap-1.5 break-words rounded-md border border-border bg-surface-raised px-3 py-2 font-mono text-[13px] text-foreground">
          <FileText className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          {file.fileName}.pdf
        </code>
        <CopyButton value={file.fileName} label="Copiar nome" copiedMessage="Nome do arquivo copiado." />
        <CopyButton value={file.fullPath} label="Copiar caminho" copiedMessage="Caminho copiado." variant="ghost" />
      </div>
    </div>
  );
}
