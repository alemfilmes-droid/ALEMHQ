"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { StatusDot } from "@/components/ui/status-dot";
import { MyPautaRow } from "@/features/minhas-pautas/components/my-pauta-row";
import type { MyPautasBoard } from "@/features/minhas-pautas/types";
import type { PautaWithDetails } from "@/types";

interface Section {
  key: string;
  label: string;
  tone: "danger" | "warning" | "neutral";
  pautas: PautaWithDetails[];
}

interface MyPautasListProps {
  board: MyPautasBoard;
  currentUserId: string;
  onOpen: (id: string) => void;
  /** Mostra o ponto do squad de origem em cada linha (quem está em mais de um squad). */
  showSquad?: boolean;
  /** Há filtro ativo: o estado vazio fala do filtro, não de "nada com você". */
  filtered?: boolean;
}

export function MyPautasList({ board, currentUserId, onOpen, showSquad = false, filtered = false }: MyPautasListProps) {
  const sections: Section[] = [
    { key: "atrasadas", label: "Atrasadas", tone: "danger", pautas: board.atrasadas },
    { key: "hoje", label: "Hoje", tone: "warning", pautas: board.hoje },
    { key: "esta_semana", label: "Esta semana", tone: "neutral", pautas: board.estaSemana },
    { key: "depois", label: "Depois", tone: "neutral", pautas: board.depois },
  ];

  const isEmpty = sections.every((section) => section.pautas.length === 0) && board.acompanhando.length === 0 && board.devolvidas.length === 0;

  if (isEmpty && filtered) {
    return (
      <div className="flex flex-col items-center rounded-lg border border-dashed border-border-strong px-6 py-16 text-center">
        <p className="font-bold">Nenhuma pauta com esses filtros.</p>
        <p className="mt-1 text-sm text-muted-foreground">Ajuste a busca ou limpe os filtros.</p>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center rounded-lg border border-dashed border-border-strong px-6 py-24 text-center">
        <p className="font-display text-2xl font-black tracking-tight">Nada com você agora.</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Veja o que está agendado para os próximos dias na{" "}
          <Link href="?visao=calendario" className="underline underline-offset-4 hover:text-foreground">
            visão de calendário
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {sections.map((section) =>
        section.pautas.length === 0 ? null : (
          <section key={section.key} aria-labelledby={`grupo-${section.key}`} className="space-y-3">
            <h2 id={`grupo-${section.key}`} className="flex items-center gap-2 text-sm font-bold">
              <StatusDot tone={section.tone} />
              {section.label.toUpperCase()}
              <span className="font-normal text-subtle">({section.pautas.length})</span>
            </h2>
            <div className="space-y-2">
              {section.pautas.map((pauta) => (
                <MyPautaRow key={pauta.id} pauta={pauta} currentUserId={currentUserId} onOpen={() => onOpen(pauta.id!)} showSquad={showSquad} />
              ))}
            </div>
          </section>
        ),
      )}

      {board.acompanhando.length > 0 ? (
        <details className="group rounded-lg border border-border">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-bold">
            <span>ACOMPANHANDO ({board.acompanhando.length})</span>
            <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <div className="space-y-2 border-t border-border p-3">
            {board.acompanhando.map((pauta) => (
              <MyPautaRow key={pauta.id} pauta={pauta} currentUserId={currentUserId} onOpen={() => onOpen(pauta.id!)} showSquad={showSquad} />
            ))}
          </div>
        </details>
      ) : null}

      {board.devolvidas.length > 0 ? (
        <details className="group rounded-lg border border-border">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-bold">
            <span>DEVOLVIDAS ({board.devolvidas.length})</span>
            <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <div className="space-y-2 border-t border-border p-3">
            {board.devolvidas.map((pauta) => (
              <MyPautaRow key={pauta.id} pauta={pauta} currentUserId={currentUserId} onOpen={() => onOpen(pauta.id!)} showSquad={showSquad} muted />
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
