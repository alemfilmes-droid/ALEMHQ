"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Squad } from "@/types";

/**
 * Squads de cada pessoa ativa (profileId → squads), carregados uma vez no layout do app. Com isso o
 * <UserAvatar> e as barras de card resolvem o squad principal de qualquer pessoa sem que cada
 * consulta (views de pautas, CRM, agenda…) precise trazer os squads junto.
 */
export type SquadDirectory = Record<string, Squad[]>;

const SquadDirectoryContext = createContext<SquadDirectory>({});

export function SquadDirectoryProvider({ directory, children }: { directory: SquadDirectory; children: ReactNode }) {
  return <SquadDirectoryContext.Provider value={directory}>{children}</SquadDirectoryContext.Provider>;
}

export function useSquadDirectory(): SquadDirectory {
  return useContext(SquadDirectoryContext);
}
