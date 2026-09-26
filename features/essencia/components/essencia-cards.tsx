import Link from "next/link";
import { ArrowUpRight, Compass, Flame, Users } from "lucide-react";
import { CARD_LINK_CLASS, CardIcon } from "@/components/ui/card";
import { listEssenciaDocuments, type EssenciaSlug } from "@/features/essencia/content";
import type { LucideIcon } from "lucide-react";

export const ESSENCIA_ICON: Record<EssenciaSlug, LucideIcon> = { manifesto: Flame, valores: Compass, cultura: Users };

/** Seção "Essência" no fim do Início: Manifesto, Valores e Cultura, cada um levando à própria página. */
export async function EssenciaCards() {
  const documents = await listEssenciaDocuments();

  return (
    <section aria-labelledby="essencia-title" className="mt-14 space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="eyebrow">Essência</p>
          <h2 id="essencia-title" className="font-display text-2xl font-black tracking-tight">
            Quem a Além é.
          </h2>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {documents.map((document) => (
          <Link key={document.slug} href={`/essencia/${document.slug}`} className={`${CARD_LINK_CLASS} group relative overflow-hidden p-6`}>
            <span aria-hidden className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-brand-accent/50 to-transparent" />
            <div className="flex items-start justify-between gap-3">
              <CardIcon icon={ESSENCIA_ICON[document.slug]} />
              <ArrowUpRight className="size-4 text-subtle transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" aria-hidden />
            </div>
            <p className="mt-6 font-display text-2xl font-black tracking-tight">{document.title}</p>
            <p className="text-sm font-semibold text-muted-foreground">— {document.kicker}</p>
            <p className="mt-4 text-sm text-subtle">{document.summary}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
