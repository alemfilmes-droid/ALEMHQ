import { ChevronRight, Folder, FolderTree } from "lucide-react";
import { CopyButton } from "@/components/ui/copy-button";
import type { DriveFolder } from "@/lib/drive-folder";

/**
 * Caminho esperado da pasta no Drive (breadcrumb), o nome da pasta com "Copiar nome da pasta" e as
 * subpastas padrão. Sem estado: serve no servidor e no cliente.
 */
export function DriveFolderPreview({ folder, compact = false }: { folder: DriveFolder; compact?: boolean }) {
  return (
    <div className="space-y-3">
      <nav aria-label="Caminho da pasta no Drive" className="flex flex-wrap items-center gap-1 text-[12px] text-muted-foreground">
        <FolderTree className="mr-1 size-3.5 shrink-0" aria-hidden />
        {folder.parents.map((part) => (
          <span key={part} className="flex items-center gap-1">
            {part}
            <ChevronRight className="size-3 text-subtle" aria-hidden />
          </span>
        ))}
      </nav>
      <div className="flex flex-wrap items-center gap-3">
        <code className="min-w-0 break-words rounded-md border border-border bg-surface-raised px-3 py-2 font-mono text-[13px] text-foreground">{folder.folderName}</code>
        <CopyButton value={folder.folderName} label="Copiar nome da pasta" copiedMessage="Nome da pasta copiado." />
        {compact ? null : <CopyButton value={folder.fullPath} label="Copiar caminho" copiedMessage="Caminho completo copiado." variant="ghost" />}
      </div>
      <ul className="flex flex-wrap gap-2" aria-label="Subpastas">
        {folder.subfolders.map((name) => (
          <li key={name} className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[12px] text-muted-foreground">
            <Folder className="size-3" aria-hidden />
            {name}
          </li>
        ))}
      </ul>
    </div>
  );
}
