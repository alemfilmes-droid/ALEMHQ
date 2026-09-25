import { ExternalLink as ExternalLinkIcon } from "lucide-react";

interface ExternalLinkProps {
  href: string;
  label: string;
}

/** Rótulo curto e clicável; a URL completa só aparece no atributo title. */
export function ExternalLink({ href, label }: ExternalLinkProps) {
  return (
    <a
      href={href}
      title={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 font-semibold text-foreground underline underline-offset-4 hover:text-muted-foreground"
    >
      {label}
      <ExternalLinkIcon className="size-3" aria-hidden />
    </a>
  );
}
