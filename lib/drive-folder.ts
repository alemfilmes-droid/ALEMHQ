/**
 * Padrão de pastas do Drive da Além:
 *
 * ALÉM.FILMES > AUDIOVISUAL (ou ADMINISTRATIVO) > <ano> > Q1|Q2|Q3|Q4 > <MÊS>
 *   > [dd/mm/aaaa] <projeto> - <cliente> [<iniciais do responsável>]
 *     > [00] ROTEIRO, [01] BRUTOS, [02] PROJETO, [03] ASSETS, [04] FINALIZADO
 *
 * Gerado a partir da data de início, do nome do projeto, do cliente e do líder — ninguém digita o
 * nome à mão. Puro (sem servidor): serve no projeto, nos fluxogramas e em qualquer tela.
 */

export type DriveArea = "AUDIOVISUAL" | "ADMINISTRATIVO";

export const DRIVE_ROOT = "ALÉM.FILMES";
export const DRIVE_SUBFOLDERS = ["[00] ROTEIRO", "[01] BRUTOS", "[02] PROJETO", "[03] ASSETS", "[04] FINALIZADO"] as const;

const MONTHS = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];

export interface DriveFolderInput {
  /** Data de início do projeto (yyyy-mm-dd). */
  date: string;
  projectName: string;
  clientName: string;
  /** Nome do líder/responsável — vira as iniciais. */
  ownerName: string;
  area?: DriveArea;
}

export interface DriveFolder {
  /** Caminho até a pasta do mês (onde a pasta do projeto é criada). */
  parents: string[];
  /** Nome da pasta do projeto. */
  folderName: string;
  /** Caminho completo, com " > " entre os níveis. */
  fullPath: string;
  subfolders: readonly string[];
}

/** "Anderson Felipe Silva" → "AFS"; "Paulo Daniel Nunes Fidelis" → "PDNF" (sem preposições). */
export function initialsOf(name: string): string {
  const skip = new Set(["da", "de", "do", "das", "dos", "e"]);
  return name
    .trim()
    .split(/\s+/)
    .filter((part) => part && !skip.has(part.toLowerCase()))
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

/** Remove o que o Drive/Windows estranha num nome e espaços duplos. */
function clean(text: string): string {
  return text.replace(/[\\:*?"<>|]/g, "").replace(/\s+/g, " ").trim();
}

export function buildDriveFolder({ date, projectName, clientName, ownerName, area = "AUDIOVISUAL" }: DriveFolderInput): DriveFolder {
  const [year = "", month = "01", day = "01"] = date.slice(0, 10).split("-");
  const monthIndex = Math.min(Math.max(Number(month) - 1, 0), 11);
  const quarter = `Q${Math.floor(monthIndex / 3) + 1}`;
  const initials = initialsOf(ownerName);
  const folderName = `[${day}/${month}/${year}] ${clean(projectName)} - ${clean(clientName)}${initials ? ` [${initials}]` : ""}`;
  const parents = [DRIVE_ROOT, area, year, quarter, MONTHS[monthIndex]!];
  return { parents, folderName, fullPath: [...parents, folderName].join(" > "), subfolders: DRIVE_SUBFOLDERS };
}
