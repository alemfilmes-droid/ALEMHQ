import { dependencyLines, type DeletionCounts } from "@/lib/clients/deletion";

/** O que está ligado ao cliente, em português simples (só o que existe). */
export function DependencyList({ counts }: { counts: DeletionCounts }) {
  const lines = dependencyLines(counts);
  if (lines.length === 0) return <p className="text-[13px] text-muted-foreground">Nada ligado (só contatos).</p>;
  return (
    <ul className="space-y-1 text-[13px]">
      {lines.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  );
}
