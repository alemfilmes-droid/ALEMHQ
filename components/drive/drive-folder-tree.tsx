import { Folder, FolderOpen } from "lucide-react";
import { CopyButton } from "@/components/ui/copy-button";
import type { DriveFolder } from "@/lib/drive-folder";
import { cn } from "@/lib/utils";

/** O que vai em cada subpasta do projeto (o mapa mais consultado da equipe). */
export const SUBFOLDER_CONTENTS: Record<string, string> = {
  "[00] ROTEIRO": "roteiro, decupagem e briefing",
  "[01] BRUTOS": "tudo o que saiu da câmera, como gravado",
  "[02] PROJETO": "o projeto de edição (Premiere, DaVinci, After)",
  "[03] ASSETS": "trilhas, efeitos, logos, fontes e motion",
  "[04] FINALIZADO": "exports finais e versões enviadas",
};

/**
 * Árvore de pastas do Drive em CSS (sem imagem): o caminho até a pasta do projeto e as 5 subpastas
 * com o que vai em cada uma. Linhas guia em borda; a pasta do projeto ganha o acento.
 */
export function DriveFolderTree({ folder }: { folder: DriveFolder }) {
  const levels = [...folder.parents, folder.folderName];
  return (
    <div className="overflow-x-auto rounded-md border border-border bg-surface-raised p-3 font-mono text-[12px] sm:text-[13px]">
      <TreeLevel names={levels} index={0} subfolders={folder.subfolders} />
      <div className="mt-3 flex flex-wrap gap-2 font-sans">
        <CopyButton value={folder.folderName} label="Copiar nome da pasta" copiedMessage="Nome da pasta copiado." />
        <CopyButton value={folder.fullPath} label="Copiar caminho" copiedMessage="Caminho copiado." variant="ghost" />
      </div>
    </div>
  );
}

function TreeLevel({ names, index, subfolders }: { names: string[]; index: number; subfolders: readonly string[] }) {
  const name = names[index];
  if (name === undefined) return null;
  const isProject = index === names.length - 1;
  return (
    <ul className={cn(index > 0 && "ml-3 border-l border-border-strong pl-3")}>
      <li>
        <span className={cn("relative flex items-center gap-1.5 py-0.5", index > 0 && "before:absolute before:-left-3 before:top-1/2 before:h-px before:w-2.5 before:bg-border-strong")}>
          {isProject ? <FolderOpen className="size-3.5 shrink-0 text-brand-accent" aria-hidden /> : <Folder className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />}
          <span className={cn("whitespace-nowrap", isProject ? "font-bold text-foreground" : "text-muted-foreground")}>{name}</span>
        </span>
        {isProject ? (
          <ul className="ml-3 border-l border-border-strong pl-3">
            {subfolders.map((sub) => (
              <li key={sub} className="relative flex flex-wrap items-baseline gap-x-2 py-0.5 before:absolute before:-left-3 before:top-1/2 before:h-px before:w-2.5 before:bg-border-strong">
                <span className="flex items-center gap-1.5 whitespace-nowrap text-foreground">
                  <Folder className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  {sub}
                </span>
                {SUBFOLDER_CONTENTS[sub] ? <span className="font-sans text-[12px] text-subtle">{SUBFOLDER_CONTENTS[sub]}</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <TreeLevel names={names} index={index + 1} subfolders={subfolders} />
        )}
      </li>
    </ul>
  );
}
