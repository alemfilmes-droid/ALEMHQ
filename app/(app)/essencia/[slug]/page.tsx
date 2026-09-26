import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { CardIcon } from "@/components/ui/card";
import { ESSENCIA_ICON } from "@/features/essencia/components/essencia-cards";
import { ESSENCIA_SLUGS, getEssenciaDocument, isEssenciaSlug, listEssenciaDocuments } from "@/features/essencia/content";
import { cn } from "@/lib/utils";

type Params = Promise<{ slug: string }>;

export function generateStaticParams() {
  return ESSENCIA_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  if (!isEssenciaSlug(slug)) return {};
  const document = await getEssenciaDocument(slug);
  return { title: document.title };
}

/**
 * Página de um documento da Essência (Manifesto, Valores, Cultura): leitura para toda a equipe.
 * A edição pela diretoria fica para depois — ver features/essencia/content.ts.
 */
export default async function EssenciaPage({ params }: { params: Params }) {
  const { slug } = await params;
  if (!isEssenciaSlug(slug)) notFound();
  const [document, all] = await Promise.all([getEssenciaDocument(slug), listEssenciaDocuments()]);
  const index = all.findIndex((item) => item.slug === slug);
  const previous = index > 0 ? all[index - 1] : undefined;
  const next = index < all.length - 1 ? all[index + 1] : undefined;

  return (
    <article className="mx-auto max-w-4xl">
      <nav aria-label="Essência" className="mb-10 flex flex-wrap items-center gap-2">
        <Link href="/inicio" className="mr-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
          Início
        </Link>
        {all.map((item) => (
          <Link
            key={item.slug}
            href={`/essencia/${item.slug}`}
            aria-current={item.slug === slug ? "page" : undefined}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors",
              item.slug === slug ? "border-brand-accent/60 text-foreground" : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground",
            )}
          >
            {item.title}
          </Link>
        ))}
      </nav>

      <header className="card-surface card-static hero-surface relative overflow-hidden rounded-xl px-6 py-10 sm:px-10 sm:py-14">
        <span aria-hidden className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-brand-accent/40 to-transparent" />
        <div className="relative space-y-6">
          <div className="flex items-center gap-3">
            <CardIcon icon={ESSENCIA_ICON[slug]} />
            <p className="eyebrow">
              {document.title} — {document.kicker}
            </p>
          </div>
          <h1 className="font-display text-4xl font-black leading-[1.02] tracking-tight sm:text-6xl">
            {document.lead.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </h1>
        </div>
      </header>

      <div className="mt-14 space-y-14">
        {document.sections.map((section, sectionIndex) => (
          <section key={section.number} aria-labelledby={`secao-${section.number}`} className="grid gap-6 sm:grid-cols-[5.5rem_minmax(0,1fr)]">
            <p aria-hidden className="font-display text-5xl font-black leading-none tracking-tight text-transparent [-webkit-text-stroke:1px_rgb(var(--brand-accent-rgb)/0.7)]">
              {section.number}
            </p>
            <div className="min-w-0 space-y-4">
              <h2 id={`secao-${section.number}`} className="font-display text-2xl font-black tracking-tight sm:text-3xl">
                {section.title}
              </h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} className="max-w-2xl text-base leading-relaxed text-muted-foreground">
                  {paragraph}
                </p>
              ))}
              {section.items ? (
                <ol className="grid gap-3 sm:grid-cols-2">
                  {section.items.map((item) => (
                    <li key={item.number} className="card-surface card-static rounded-lg p-5">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-accent">{item.number}</p>
                      <p className="mt-2 font-bold">{item.title}</p>
                      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.text}</p>
                    </li>
                  ))}
                </ol>
              ) : null}
            </div>

            {/* Citação em destaque depois da segunda seção (ou da única, se houver só uma). */}
            {sectionIndex === Math.min(1, document.sections.length - 1) ? (
              <blockquote className="relative rounded-xl border border-border-card py-8 pl-8 pr-6 sm:col-span-2 sm:pl-10">
                <span aria-hidden className="accent-rule absolute inset-y-6 left-0 w-[2px]" />
                <p className="font-display text-3xl font-black leading-tight tracking-tight sm:text-4xl">
                  {document.quote.lines.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </p>
                <footer className="mt-4 text-sm font-semibold text-subtle">{document.quote.attribution}</footer>
              </blockquote>
            ) : null}
          </section>
        ))}
      </div>

      <footer className="mt-16 border-t border-border pt-10">
        <p className="font-display text-2xl font-black leading-tight tracking-tight sm:text-3xl">
          {document.closing.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </p>
        <p className="mt-4 text-xs text-subtle">Fonte: {document.source}</p>

        <nav aria-label="Outros documentos" className="mt-10 grid gap-3 sm:grid-cols-2">
          {previous ? (
            <Link href={`/essencia/${previous.slug}`} className="card-surface group flex items-center gap-3 rounded-lg p-4">
              <ArrowLeft className="size-4 text-subtle group-hover:text-foreground" aria-hidden />
              <span>
                <span className="block text-xs text-subtle">Anterior</span>
                <span className="font-bold">{previous.title}</span>
              </span>
            </Link>
          ) : (
            <span className="hidden sm:block" />
          )}
          {next ? (
            <Link href={`/essencia/${next.slug}`} className="card-surface group flex items-center justify-end gap-3 rounded-lg p-4 text-right">
              <span>
                <span className="block text-xs text-subtle">Próximo</span>
                <span className="font-bold">{next.title}</span>
              </span>
              <ArrowRight className="size-4 text-subtle group-hover:text-foreground" aria-hidden />
            </Link>
          ) : null}
        </nav>
      </footer>
    </article>
  );
}
