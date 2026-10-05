import {
  CheckCheck,
  ClipboardCopy,
  FileOutput,
  FolderDown,
  GitFork,
  Hourglass,
  LogIn,
  PenLine,
  Play,
  Send,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import type { ActionKind } from "@/features/processes/types";

/** Um ícone por tipo de ação — o mesmo no fluxograma, no checklist e no modo execução. */
export const ACTION_ICONS: Record<ActionKind, LucideIcon> = {
  copiar: ClipboardCopy,
  conferir: CheckCheck,
  acessar: LogIn,
  emitir: FileOutput,
  enviar: Send,
  salvar: FolderDown,
  registrar: PenLine,
  aprovar: ShieldCheck,
  aguardar: Hourglass,
  decidir: GitFork,
  executar: Play,
};
