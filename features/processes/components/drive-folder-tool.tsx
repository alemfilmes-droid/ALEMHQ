"use client";

import { useState } from "react";
import { DriveFolderPreview } from "@/components/drive/drive-folder-preview";
import { SearchSelect } from "@/components/ui/search-select";
import { buildDriveFolder } from "@/lib/drive-folder";

export interface DriveProjectOption {
  id: string;
  name: string;
  clientName: string;
  ownerName: string;
  startDate: string;
}

/** Ferramenta dentro do passo: escolha o projeto e copie o nome/caminho da pasta no padrão. */
export function DriveFolderTool({ projects, initialProjectId }: { projects: DriveProjectOption[]; initialProjectId?: string | null }) {
  const [projectId, setProjectId] = useState(initialProjectId ?? "");
  const project = projects.find((item) => item.id === projectId);

  return (
    <div className="space-y-3 rounded-md border border-border bg-surface-raised p-3">
      <p className="text-[12px] font-bold text-muted-foreground">Gerador da pasta do Drive</p>
      <SearchSelect
        id="drive-tool-project"
        value={projectId}
        onChange={setProjectId}
        options={projects.map((item) => ({ value: item.id, label: `${item.name} · ${item.clientName}` }))}
        placeholder="Escolha o projeto"
        emptyLabel="Nenhum projeto encontrado."
      />
      {project ? (
        <DriveFolderPreview
          compact
          folder={buildDriveFolder({ date: project.startDate, projectName: project.name, clientName: project.clientName, ownerName: project.ownerName })}
        />
      ) : (
        <p className="text-[12px] text-subtle">O nome sai da data de início, do projeto, do cliente e das iniciais do líder.</p>
      )}
    </div>
  );
}
