import { ClientFinanceTable } from "@/features/finance/components/client-finance-table";
import { getFinanceByClient } from "@/features/finance/queries";

export async function ByClientTab() {
  const rows = await getFinanceByClient();
  return <ClientFinanceTable rows={rows} />;
}
