import Link from "next/link";
import { ClientAvatar } from "@/components/companies/client-avatar";
import { INTERNAL_PROJECT_LABEL } from "@/lib/domain";
import { cn } from "@/lib/utils";

interface ProjectClientLabelProps {
  isInternal: boolean;
  company: { id: string; name: string; logo_url?: string | null } | null;
  asLink?: boolean;
  /** Mostra o logo (ou monograma) do cliente antes do nome. */
  withAvatar?: boolean;
  className?: string;
}

/** Internos mostram "Interno — Além Filmes" no lugar do cliente. */
export function ProjectClientLabel({ isInternal, company, asLink = false, withAvatar = false, className }: ProjectClientLabelProps) {
  const internal = isInternal || !company;
  const name = internal ? INTERNAL_PROJECT_LABEL : company.name;
  const text = !internal && asLink ? (
    <Link href={`/clientes/${company.id}`} className="underline underline-offset-4 hover:text-foreground">
      {name}
    </Link>
  ) : (
    name
  );

  if (!withAvatar) return <>{text}</>;
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      <ClientAvatar name={internal ? "Além Filmes" : company.name} logoUrl={internal ? null : company.logo_url} size="sm" />
      <span className="min-w-0 truncate">{text}</span>
    </span>
  );
}
