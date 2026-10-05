import { History } from "lucide-react";
import { Money } from "@/components/ui/money";
import { toCents } from "@/features/finance/money";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

const TYPE_LABELS: Record<string, string> = {
  definicao: "Definição",
  substituicao: "Substituição",
  adicional: "Serviço adicional",
  manter: "Mantido",
};

/** Histórico de valores do contrato do projeto (só financeiro — a RLS repete). */
export async function ContractHistory({ projectId }: { projectId: string }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("project_contract_changes")
    .select("id, change_type, previous_value, new_value, amount, description, note, created_at, author:profiles!project_contract_changes_changed_by_fkey(full_name)")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(50);
  const rows = data ?? [];

  if (rows.length === 0) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <History className="size-4" aria-hidden />
        Nenhuma mudança de valor registrada. Mudanças feitas por orçamentos aparecem aqui.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="text-[12px] text-subtle">
            <th className="py-2 pr-3 font-semibold">Data</th>
            <th className="py-2 pr-3 font-semibold">Tipo</th>
            <th className="py-2 pr-3 text-right font-semibold">Valor anterior</th>
            <th className="py-2 pr-3 text-right font-semibold">Valor novo</th>
            <th className="py-2 pr-3 font-semibold">Autor</th>
            <th className="py-2 font-semibold">Observação</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="whitespace-nowrap py-2.5 pr-3">{formatDateTime(row.created_at)}</td>
              <td className="py-2.5 pr-3">
                <span className="font-semibold">{TYPE_LABELS[row.change_type] ?? row.change_type}</span>
                {row.change_type === "adicional" && row.amount != null ? (
                  <span className="block text-[12px] text-muted-foreground">
                    {row.description ?? "Serviço adicional"} · + <Money cents={toCents(row.amount)} />
                  </span>
                ) : null}
              </td>
              <td className="py-2.5 pr-3 text-right tabular-nums text-muted-foreground">{row.previous_value == null ? "—" : <Money cents={toCents(row.previous_value)} />}</td>
              <td className="py-2.5 pr-3 text-right font-bold tabular-nums">{row.new_value == null ? "—" : <Money cents={toCents(row.new_value)} />}</td>
              <td className="py-2.5 pr-3 text-muted-foreground">{row.author?.full_name ?? "—"}</td>
              <td className="py-2.5 text-muted-foreground">{row.note ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
