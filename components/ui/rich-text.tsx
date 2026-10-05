import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Texto rico dos avisos: um subconjunto pequeno de Markdown, renderizado em elementos React — nunca
 * HTML cru (nada de dangerouslySetInnerHTML), então não há como injetar script pelo conteúdo.
 *
 * Suporta: parágrafos, "## título", listas "- " e "1. ", "> citação", **negrito**, *itálico* e
 * [links](https://…). Links só com http(s), mailto ou rota interna do sistema (/fluxogramas/…).
 */

const INLINE = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|\[[^\]]+\]\([^)\s]+\))/g;

function safeHref(href: string): string | null {
  return /^(https?:\/\/|mailto:)/i.test(href) || /^\/(?!\/)[\w\-/?=&#%.]*$/.test(href) ? href : null;
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  return text.split(INLINE).map((part, index) => {
    const key = `${keyPrefix}-${index}`;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={key} className="font-bold text-foreground">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <em key={key}>{part.slice(1, -1)}</em>;
    }
    const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part);
    if (link) {
      const href = safeHref(link[2] ?? "");
      return href ? (
        <a
          key={key}
          href={href}
          {...(href.startsWith("/") ? {} : { target: "_blank", rel: "noopener noreferrer" })}
          className="font-semibold underline underline-offset-4 hover:text-muted-foreground"
        >
          {link[1]}
        </a>
      ) : (
        <Fragment key={key}>{link[1]}</Fragment>
      );
    }
    return <Fragment key={key}>{part}</Fragment>;
  });
}

type Block =
  | { kind: "p"; lines: string[] }
  | { kind: "h"; text: string }
  | { kind: "quote"; lines: string[] }
  | { kind: "ul" | "ol"; items: string[] };

function parse(source: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of source.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    const last = blocks.at(-1);
    if (!line.trim()) {
      blocks.push({ kind: "p", lines: [] });
      continue;
    }
    const heading = /^#{1,3}\s+(.*)$/.exec(line);
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    const ordered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    const quote = /^>\s?(.*)$/.exec(line);
    if (heading) blocks.push({ kind: "h", text: heading[1] ?? "" });
    else if (bullet) {
      if (last?.kind === "ul") last.items.push(bullet[1] ?? "");
      else blocks.push({ kind: "ul", items: [bullet[1] ?? ""] });
    } else if (ordered) {
      if (last?.kind === "ol") last.items.push(ordered[1] ?? "");
      else blocks.push({ kind: "ol", items: [ordered[1] ?? ""] });
    } else if (quote) {
      if (last?.kind === "quote") last.lines.push(quote[1] ?? "");
      else blocks.push({ kind: "quote", lines: [quote[1] ?? ""] });
    } else if (last?.kind === "p" && last.lines.length > 0) last.lines.push(line);
    else blocks.push({ kind: "p", lines: [line] });
  }
  return blocks.filter((block) => !(block.kind === "p" && block.lines.length === 0));
}

export function RichText({ source, className }: { source: string; className?: string }) {
  const blocks = parse(source);
  return (
    <div className={cn("space-y-3 text-sm leading-relaxed text-muted-foreground", className)}>
      {blocks.map((block, index) => {
        const key = `b${index}`;
        switch (block.kind) {
          case "h":
            return (
              <h3 key={key} className="pt-1 text-base font-bold text-foreground">
                {renderInline(block.text, key)}
              </h3>
            );
          case "ul":
          case "ol": {
            const List = block.kind;
            return (
              <List key={key} className={cn("space-y-1 pl-5", block.kind === "ul" ? "list-disc" : "list-decimal")}>
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex}>{renderInline(item, `${key}-${itemIndex}`)}</li>
                ))}
              </List>
            );
          }
          case "quote":
            return (
              <blockquote key={key} className="border-l-2 border-brand-accent/60 pl-4 text-foreground">
                {block.lines.map((line, lineIndex) => (
                  <p key={lineIndex}>{renderInline(line, `${key}-${lineIndex}`)}</p>
                ))}
              </blockquote>
            );
          case "p":
            return (
              <p key={key}>
                {block.lines.map((line, lineIndex) => (
                  <Fragment key={lineIndex}>
                    {lineIndex > 0 ? <br /> : null}
                    {renderInline(line, `${key}-${lineIndex}`)}
                  </Fragment>
                ))}
              </p>
            );
        }
      })}
    </div>
  );
}

/** Texto puro (sem marcação) para resumos e notificações. */
export function plainText(source: string): string {
  return source
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*#>`]/g, "")
    .replace(/^\s*[-\d.)]+\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}
