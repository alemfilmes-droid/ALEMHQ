import { Users } from "lucide-react";
import { EmptyState, TableShell, Th } from "@/features/finance/components/table-shell";
import type { OwnerPerformanceItem } from "@/features/crm/types";

export function OwnerPerformanceTable({ data }: { data: OwnerPerformanceItem[] }) {
  if (data.length === 0) {
    return <EmptyState icon={Users} title="Nenhum negócio cadastrado ainda." />;
  }

  return (
    <TableShell minWidth="min-w-[640px]">
      <thead>
        <tr>
          <Th>Responsável</Th>
          <Th align="right">Abertos</Th>
          <Th align="right">Reuniões</Th>
          <Th align="right">Ganhos</Th>
          <Th align="right">Perdidos</Th>
          <Th align="right">Conversão</Th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {data.map((row) => (
          <tr key={row.ownerId}>
            <td className="px-4 py-3 font-semibold">{row.ownerName}</td>
            <td className="px-4 py-3 text-right tabular-nums">{row.openDeals}</td>
            <td className="px-4 py-3 text-right tabular-nums">{row.meetings}</td>
            <td className="px-4 py-3 text-right tabular-nums">{row.won}</td>
            <td className="px-4 py-3 text-right tabular-nums">{row.lost}</td>
            <td className="px-4 py-3 text-right tabular-nums">{row.conversionRate != null ? `${String(row.conversionRate).replace(".", ",")}%` : "—"}</td>
          </tr>
        ))}
      </tbody>
    </TableShell>
  );
}
