"use client";

import { useState } from "react";
import { DriveFolderPreview } from "@/components/drive/drive-folder-preview";
import { DriveFolderTree } from "@/components/drive/drive-folder-tree";
import { SearchSelect } from "@/components/ui/search-select";
import { buildDriveFolder } from "@/lib/drive-folder";

export interface DriveProjectOption {
  id: string;
  name: string;
  clientName: string;
  ownerName: string;
  startDate: string;
}

/** Exemplo quando nenhum projeto foi escolhido (o mesmo do processo "Onde encontrar os arquivos"). */
const EXAMPLE = { date: "2026-09-14", projectName: "Fest Show 2026", clientName: "Colégio Contemporâneo", ownerName: "Anderson Felipe" };

/**
 * Ferramenta dentro do passo: escolha o projeto e copie o nome/caminho da pasta no padrão. A
 * variante "tree" desenha a árvore inteira com as subpastas (processo "Onde encontrar os arquivos").
 */
export function DriveFolderTool({ projects, initialProjectId, variant = "name" }: { projects: DriveProjectOption[]; initialProjectId?: string | null; variant?: "name" | "tree" }) {
  const [projectId, setProjectId] = useState(initialProjectId ?? "");
  const project = projects.find((item) => item.id === projectId);
  const folder = buildDriveFolder(
    project ? { date: project.startDate, projectName: project.name, clientName: project.clientName, ownerName: project.ownerName } : EXAMPLE,
  );

  return (
    <div className="space-y-3 rounded-md border border-border bg-surface-raised p-3 print:hidden">
      <p className="text-[12px] font-bold text-muted-foreground">{variant === "tree" ? "Árvore de pastas do projeto" : "Gerador da pasta do Drive"}</p>
      {projects.length > 0 ? (
        <SearchSelect
          id={`drive-tool-${variant}`}
          value={projectId}
          onChange={setProjectId}
          options={projects.map((item) => ({ value: item.id, label: `${item.name} · ${item.clientName}` }))}
          placeholder="Escolha o projeto"
          emptyLabel="Nenhum projeto encontrado."
        />
      ) : null}
      {!project ? <p className="text-[12px] text-subtle">Exemplo — escolha um projeto para gerar o nome real.</p> : null}
      {variant === "tree" ? <DriveFolderTree folder={folder} /> : <DriveFolderPreview compact folder={folder} />}
    </div>
  );
}
