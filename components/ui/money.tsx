import { formatCents, type Cents } from "@/features/finance/money";
import { cn } from "@/lib/utils";

/**
 * Valor em reais marcado como sensível: no modo privacidade (e no olho de cada card) aparece como
 * "R$ ••••••" — só mascara na tela de quem JÁ tem acesso. Quem não tem acesso ao financeiro nem
 * recebe o valor do servidor (RLS + capability), então não há o que mascarar.
 */
export function Money({ cents, className }: { cents: Cents; className?: string }) {
  return (
    <span data-sensitive className={cn("whitespace-nowrap", className)}>
      {formatCents(cents)}
    </span>
  );
}
