import type { CSSProperties, ReactNode } from "react";
import { brl, computeBudget, pctNumber, SECTION_LABELS, type BudgetSection } from "@/features/budgets/pricing";
import type { BudgetRecord, PresentationContent, ProposalProfile } from "@/features/budgets/types";

/*
 * Apresentação comercial em slides 16:9 (1280×720 na impressão). Tipografia da Além (Archivo 900 nos
 * títulos, Inter no texto), fundo preto, muito respiro e a cor de destaque escolhida como acento.
 * Três estruturas (Manifesto, Executivo, Tratamento do diretor); todas abrem com a Além e a mente por
 * trás dela e terminam no investimento resumido — nunca custos internos.
 */

const FALLBACK_ABOUT =
  "A Além Filmes é uma produtora audiovisual que transforma marcas em histórias com acabamento de cinema. Do roteiro à entrega, cada projeto é desenhado para emocionar, posicionar e gerar resultado.";
/** Foto padrão do fundador em toda apresentação (public/brand/fundador.jpg). */
const FOUNDER_PHOTO = "/brand/fundador.jpg";
const FALLBACK_MANIFESTO = ["Não fazemos vídeos.", "Construímos imagem.", "Cada frame tem intenção.", "Cada história, um propósito.", "Visão além do óbvio."];

interface DeckData {
  budget: BudgetRecord;
  profile: ProposalProfile;
  content: PresentationContent;
}

function lines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * Tamanho de texto pelo comprimento: textos longos encolhem em vez de vazar do slide (o slide tem
 * altura fixa de 16:9 e nada pode ser cortado na impressão).
 */
function fitBody(text: string, base = 1.55): string {
  const length = text.length;
  const size = length <= 260 ? base * 1.2 : length <= 480 ? base : length <= 760 ? base * 0.85 : length <= 1100 ? base * 0.74 : base * 0.64;
  return `${Math.round(size * 100) / 100}cqw`;
}

/** Título grande da capa: encolhe com o comprimento para nunca passar de três linhas. */
function fitTitle(text: string): string {
  const length = text.length;
  return length <= 22 ? "8.4cqw" : length <= 40 ? "6.6cqw" : length <= 70 ? "5cqw" : "3.9cqw";
}

function longDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
}

// ---------------------------------------------------------------------------
// Primitivas
// ---------------------------------------------------------------------------

/** Cor escura de destaque (preto, grafite, marinho…) não aparece no fundo preto: o deck vira claro. */
export function isDarkAccent(hex: string): boolean {
  const value = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16) / 255);
  const luminance = 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
  return luminance < 0.22;
}

function Slide({ children, accent, page, client, tone = "base", bare = false }: { children: ReactNode; accent: string; page: number; client: string; tone?: "base" | "alt"; bare?: boolean }) {
  // Deck escuro por padrão; claro quando o destaque é escuro. "alt" inverte (slide de respiro).
  const lightDeck = isDarkAccent(accent);
  const dark = tone === "alt" ? lightDeck : !lightDeck;
  return (
    <section
      className="deck-slide relative mx-auto mb-8 aspect-video w-full max-w-[1280px] overflow-hidden print:mb-0"
      data-tone={dark ? "dark" : "light"}
      style={
        {
          background: dark ? "#0A0A0A" : "#F4F2EE",
          color: dark ? "#F0F0F0" : "#0A0A0A",
          containerType: "inline-size",
          ["--accent" as string]: accent,
          ["--line" as string]: dark ? "rgba(255,255,255,0.14)" : "rgba(10,10,10,0.14)",
          ["--soft" as string]: dark ? "rgba(255,255,255,0.05)" : "rgba(10,10,10,0.05)",
        } as CSSProperties
      }
    >
      <div className={`absolute inset-0 flex min-h-0 flex-col p-[5cqw] ${bare ? "" : "pb-[6.5cqw]"}`}>{children}</div>
      {bare ? null : (
        <footer className="absolute inset-x-[5cqw] bottom-[2.6cqw] flex items-center justify-between text-[0.9cqw] uppercase tracking-[0.25em] opacity-60">
          <span>Além Filmes · {client}</span>
          <span>{String(page).padStart(2, "0")}</span>
        </footer>
      )}
    </section>
  );
}

function Kicker({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-[1cqw] text-[1.05cqw] font-bold uppercase tracking-[0.3em]" style={{ color: "var(--accent)" }}>
      <span className="inline-block h-[0.15cqw] w-[3cqw]" style={{ background: "var(--accent)" }} />
      {children}
    </p>
  );
}

function Title({ children, size = "lg" }: { children: ReactNode; size?: "xl" | "lg" | "md" }) {
  const cls = size === "xl" ? "text-[7cqw] leading-[0.95]" : size === "lg" ? "text-[4.6cqw] leading-[1]" : "text-[3.2cqw] leading-[1.05]";
  return <h2 className={`font-display font-black tracking-tight ${cls}`}>{children}</h2>;
}

function Body({ children, className = "", size }: { children: ReactNode; className?: string; size?: string }) {
  return (
    <p className={`whitespace-pre-line leading-[1.55] opacity-85 ${size ? "" : "text-[1.55cqw]"} ${className}`} style={size ? { fontSize: size } : undefined}>
      {children}
    </p>
  );
}

/**
 * Fundo cinematográfico (mesma linguagem da tela de login): feixes de luz, brilho de lente na cor de
 * destaque, grão de filme, vinheta e faixas de cinema. Estático — é para PDF.
 */
function CineBackdrop({ accent }: { accent: string }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden" style={{ background: "radial-gradient(120% 90% at 70% 15%, #1b1b1b 0%, transparent 60%), radial-gradient(90% 70% at 15% 95%, #141414 0%, transparent 65%), #0A0A0A" }}>
      <div className="absolute -top-[30%] left-[6%] h-[170%] w-[34%] rotate-[14deg]" style={{ background: "linear-gradient(180deg, rgba(240,240,240,0.10), rgba(240,240,240,0.02) 55%, transparent 80%)", filter: "blur(2.2cqw)" }} />
      <div className="absolute -top-[30%] left-[40%] h-[170%] w-[22%] rotate-[14deg]" style={{ background: `linear-gradient(180deg, color-mix(in srgb, ${accent} 22%, transparent), color-mix(in srgb, ${accent} 5%, transparent) 50%, transparent 78%)`, filter: "blur(2.2cqw)" }} />
      <div className="absolute -top-[30%] left-[66%] h-[170%] w-[26%] rotate-[14deg]" style={{ background: "linear-gradient(180deg, rgba(240,240,240,0.06), transparent 70%)", filter: "blur(2.2cqw)" }} />
      <div className="absolute right-[8%] top-[10%] size-[30cqw] rounded-full" style={{ background: `radial-gradient(circle, color-mix(in srgb, ${accent} 26%, transparent) 0%, color-mix(in srgb, ${accent} 7%, transparent) 38%, transparent 68%)` }} />
      <div className="absolute -right-[10%] top-[calc(10%+15cqw)] h-[0.16cqw] w-[120%]" style={{ background: `linear-gradient(90deg, transparent, rgba(240,240,240,0.10) 35%, color-mix(in srgb, ${accent} 55%, transparent) 50%, rgba(240,240,240,0.10) 65%, transparent)`, opacity: 0.7 }} />
      <svg className="absolute inset-0 size-full opacity-[0.08] mix-blend-overlay" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
        <filter id="deck-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#deck-grain)" />
      </svg>
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 45%, transparent 35%, rgba(10,10,10,0.7) 82%, #0A0A0A 100%)" }} />
      <div className="absolute inset-x-0 top-0 h-[7%]" style={{ background: "linear-gradient(#0A0A0A, transparent)" }} />
      <div className="absolute inset-x-0 bottom-0 h-[7%]" style={{ background: "linear-gradient(transparent, #0A0A0A)" }} />
    </div>
  );
}

/** A barra diagonal do símbolo da Além, desenhada na cor de destaque. */
function BrandSlash({ accent, className = "" }: { accent: string; className?: string }) {
  return <span aria-hidden className={`absolute block ${className}`} style={{ background: accent, clipPath: "polygon(66% 0, 100% 0, 34% 100%, 0 100%)" }} />;
}

function FounderPhoto({ name, className = "" }: { name: string; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- foto do fundador (public/brand/fundador.jpg)
  return <img src={FOUNDER_PHOTO} alt={name} className={`object-cover object-[50%_35%] grayscale ${className}`} />;
}

function AlemLogo({ className = "w-[16cqw]" }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- logo da marca na apresentação impressa
  return <img src="/brand/alem-filmes_texto-branco.png" alt="Além Filmes" className={`deck-logo h-auto ${className}`} />;
}

function ClientLogo({ url, name, className = "h-[6cqw] w-[6cqw]" }: { url: string; name: string; className?: string }) {
  if (!url) return null;
  // eslint-disable-next-line @next/next/no-img-element -- logo do cliente na apresentação
  return <img src={url} alt={name} className={`${className} rounded-[0.6cqw] bg-white object-contain p-[0.6cqw]`} />;
}

// ---------------------------------------------------------------------------
// Slides reutilizados pelos três modelos
// ---------------------------------------------------------------------------

function Cover({ data, page, variant }: { data: DeckData; page: number; variant: "manifesto" | "executivo" | "tratamento" }) {
  const { budget, content, profile } = data;
  const dark = !isDarkAccent(content.accent);
  return (
    <Slide accent={content.accent} page={page} client={budget.clientName} bare>
      {dark ? <CineBackdrop accent={content.accent} /> : null}
      <BrandSlash accent={content.accent} className="-right-[4cqw] top-[8%] h-[84%] w-[30cqw] opacity-90" />
      <div className="relative flex items-start justify-between">
        <AlemLogo className="w-[17cqw]" />
        <div className="mr-[18cqw] text-right text-[1cqw] uppercase tracking-[0.3em] opacity-70">
          <p>Nº {String(budget.number).padStart(4, "0")}</p>
          {budget.version > 1 ? <p className="mt-[0.4cqw]">Versão {budget.version}</p> : null}
        </div>
      </div>
      <div className="relative mt-auto max-w-[66%] space-y-[2.2cqw]">
        <Kicker>{variant === "tratamento" ? "Tratamento" : "Proposta comercial"}</Kicker>
        <h1 className="text-balance font-display font-black leading-[0.94] tracking-tight" style={{ fontSize: fitTitle(budget.title) }}>
          {budget.title}
        </h1>
        <div className="flex items-center gap-[1.6cqw]">
          <ClientLogo url={content.clientLogoUrl} name={budget.clientName} className="h-[5cqw] w-[5cqw]" />
          <div>
            <p className="text-[1cqw] uppercase tracking-[0.3em] opacity-60">Para</p>
            <p className="font-display text-[2.2cqw] font-black leading-tight">{budget.clientName}</p>
          </div>
        </div>
      </div>
      <div className="relative mt-[3cqw] flex max-w-[66%] items-center justify-between border-t border-[color:var(--line)] pt-[1.4cqw] text-[1cqw] uppercase tracking-[0.3em] opacity-70">
        <span>{profile.tagline}</span>
        <span>{longDate(budget.issueDate)}</span>
      </div>
    </Slide>
  );
}

function Founder({ data, page, kicker = "A mente por trás" }: { data: DeckData; page: number; kicker?: string }) {
  const { profile, content, budget } = data;
  if (!profile.founderName) return null;
  return (
    <Slide accent={content.accent} page={page} client={budget.clientName}>
      <div className="grid h-full min-h-0 grid-cols-[2fr_3fr] gap-[5cqw]">
        <div className="relative min-h-0 overflow-hidden rounded-[0.8cqw] bg-[var(--soft)]">
          <FounderPhoto name={profile.founderName} className="absolute inset-0 size-full" />
          <span aria-hidden className="absolute inset-x-0 bottom-0 h-[0.4cqw]" style={{ background: content.accent }} />
        </div>
        <div className="flex min-h-0 flex-col justify-center space-y-[1.6cqw]">
          <Kicker>{kicker}</Kicker>
          <Title size="md">{profile.founderName}</Title>
          <p className="text-[1.3cqw] font-semibold uppercase tracking-[0.2em] opacity-60">{profile.founderRole}</p>
          {profile.founderBio ? <Body size={fitBody(profile.founderBio, 1.45)}>{profile.founderBio}</Body> : null}
        </div>
      </div>
    </Slide>
  );
}

function TextSlide({ data, page, kicker, title, text, tone }: { data: DeckData; page: number; kicker: string; title: string; text: string; tone?: "base" | "alt" }) {
  if (!text.trim()) return null;
  return (
    <Slide accent={data.content.accent} page={page} client={data.budget.clientName} tone={tone}>
      <div className="grid h-full grid-cols-[2fr_3fr] items-center gap-[6cqw]">
        <div className="space-y-[2cqw]">
          <Kicker>{kicker}</Kicker>
          <Title>{title}</Title>
        </div>
        <Body size={fitBody(text, 1.7)}>{text}</Body>
      </div>
    </Slide>
  );
}

function References({ data, page, kicker = "Referências", title = "O olhar do projeto" }: { data: DeckData; page: number; kicker?: string; title?: string }) {
  const refs = data.content.references;
  if (refs.length === 0) return null;
  return (
    <Slide accent={data.content.accent} page={page} client={data.budget.clientName}>
      <div className="mb-[2.5cqw] space-y-[1.2cqw]">
        <Kicker>{kicker}</Kicker>
        <Title size="md">{title}</Title>
      </div>
      <div className={`grid flex-1 gap-[1cqw] pb-[3cqw] ${refs.length <= 2 ? "grid-cols-2" : refs.length <= 4 ? "grid-cols-2 grid-rows-2" : "grid-cols-4 grid-rows-2"}`}>
        {refs.map((url) => (
          // eslint-disable-next-line @next/next/no-img-element -- referência visual enviada
          <img key={url} src={url} alt="" className="size-full rounded-[0.5cqw] object-cover" />
        ))}
      </div>
    </Slide>
  );
}

function Deliverables({ data, page }: { data: DeckData; page: number }) {
  const items = data.budget.deliverables;
  if (items.length === 0) return null;
  return (
    <Slide accent={data.content.accent} page={page} client={data.budget.clientName}>
      <div className="grid h-full grid-cols-[2fr_3fr] gap-[6cqw]">
        <div className="space-y-[2cqw] self-center">
          <Kicker>Entregáveis</Kicker>
          <Title>O que você recebe</Title>
        </div>
        <ol className="space-y-[1.4cqw] self-center">
          {items.map((item, index) => (
            <li key={item.item} className="flex items-baseline gap-[2cqw] border-b border-[color:var(--line)] pb-[1.2cqw]">
              <span className="font-display text-[1.6cqw] font-black" style={{ color: "var(--accent)" }}>
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="text-[1.9cqw] leading-snug">
                {item.item}
                {item.deadline ? <span className="block text-[1.2cqw] uppercase tracking-[0.15em] opacity-60">Prazo: {item.deadline}</span> : null}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </Slide>
  );
}

function Timeline({ data, page }: { data: DeckData; page: number }) {
  const steps = data.content.timeline;
  if (steps.length === 0) return null;
  return (
    <Slide accent={data.content.accent} page={page} client={data.budget.clientName}>
      <div className="space-y-[1.2cqw]">
        <Kicker>Cronograma</Kicker>
        <Title size="md">Do briefing à entrega</Title>
      </div>
      <div className="relative mt-auto mb-[5cqw]">
        <span className="absolute inset-x-0 top-[0.6cqw] h-[0.12cqw] bg-[var(--line)]" />
        <ol className="relative grid gap-[1.5cqw]" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
          {steps.map((step) => (
            <li key={`${step.step}-${step.when}`} className="space-y-[1.2cqw]">
              <span className="block size-[1.3cqw] rounded-full" style={{ background: "var(--accent)" }} />
              <p className="text-[1.15cqw] font-bold uppercase tracking-[0.2em] opacity-60">{step.when}</p>
              <p className="text-[1.6cqw] font-semibold leading-snug">{step.step}</p>
            </li>
          ))}
        </ol>
      </div>
    </Slide>
  );
}

function Team({ data, page, kicker = "Equipe dedicada", title = "Quem faz acontecer" }: { data: DeckData; page: number; kicker?: string; title?: string }) {
  const roles = data.budget.items.filter((item) => item.section === "profissional");
  if (roles.length === 0) return null;
  return (
    <Slide accent={data.content.accent} page={page} client={data.budget.clientName}>
      <div className="grid h-full grid-cols-[2fr_3fr] gap-[6cqw]">
        <div className="space-y-[2cqw] self-center">
          <Kicker>{kicker}</Kicker>
          <Title>{title}</Title>
        </div>
        <ul className="grid grid-cols-2 content-center gap-x-[3cqw] gap-y-[1.6cqw]">
          {roles.map((role) => (
            <li key={role.id} className="flex items-baseline gap-[1.2cqw] border-b border-[color:var(--line)] pb-[1cqw]">
              <span className="font-display text-[2cqw] font-black" style={{ color: "var(--accent)" }}>
                {role.quantity.toLocaleString("pt-BR")}×
              </span>
              <span className="text-[1.7cqw]">{role.description}</span>
            </li>
          ))}
        </ul>
      </div>
    </Slide>
  );
}

function Investment({ data, page }: { data: DeckData; page: number }) {
  const { budget, content } = data;
  const { totals } = computeBudget(budget.items, budget.feePct, budget.taxPct);
  const sections: BudgetSection[] = ["profissional", "custo"];
  return (
    <Slide accent={content.accent} page={page} client={budget.clientName}>
      <div className="grid h-full grid-cols-[3fr_2fr] gap-[6cqw]">
        <div className="flex flex-col justify-center space-y-[2.5cqw]">
          <Kicker>Investimento</Kicker>
          <div className="space-y-[1.4cqw]">
            {sections
              .filter((section) => totals.bySection[section].price > 0)
              .map((section) => (
                <div key={section} className="flex items-baseline justify-between gap-[2cqw] border-b border-[color:var(--line)] pb-[1.2cqw]">
                  <span className="text-[1.7cqw]">{SECTION_LABELS[section]}</span>
                  <span className="text-[1.7cqw] tabular-nums opacity-80">{brl(totals.bySection[section].price)}</span>
                </div>
              ))}
          </div>
          <div className="space-y-[0.8cqw]">
            <div className="flex items-baseline justify-between gap-[2cqw] text-[1.5cqw] opacity-80">
              <span>Valor do serviço</span>
              <span className="tabular-nums">{brl(totals.services)}</span>
            </div>
            <div className="flex items-baseline justify-between gap-[2cqw] text-[1.5cqw] opacity-80">
              <span>Imposto ({pctNumber(budget.taxPct)})</span>
              <span className="tabular-nums">{brl(totals.tax)}</span>
            </div>
          </div>
          <div>
            <p className="text-[1.1cqw] uppercase tracking-[0.3em] opacity-60">Investimento total</p>
            <p className="font-display text-[6cqw] font-black leading-none tracking-tight tabular-nums">{brl(totals.final)}</p>
          </div>
        </div>
        <div className="flex flex-col justify-center space-y-[2cqw] border-l border-[color:var(--line)] pl-[4cqw]">
          <div className="space-y-[0.8cqw]">
            <p className="text-[1.1cqw] font-bold uppercase tracking-[0.25em]" style={{ color: "var(--accent)" }}>
              Condições
            </p>
            <Body>{budget.paymentTerms || "A combinar."}</Body>
          </div>
          <div className="space-y-[0.8cqw]">
            <p className="text-[1.1cqw] font-bold uppercase tracking-[0.25em]" style={{ color: "var(--accent)" }}>
              Validade
            </p>
            <Body>
              Proposta válida até {new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${budget.validUntil}T12:00:00Z`))}.
            </Body>
          </div>
        </div>
      </div>
    </Slide>
  );
}

function Closing({ data, page, title = "Vamos criar juntos." }: { data: DeckData; page: number; title?: string }) {
  const { profile, content, budget } = data;
  const contacts = [profile.contactEmail, profile.contactPhone, profile.website, profile.instagram].filter(Boolean);
  return (
    <Slide accent={content.accent} page={page} client={budget.clientName} bare>
      {!isDarkAccent(content.accent) ? <CineBackdrop accent={content.accent} /> : null}
      <AlemLogo className="relative w-[16cqw]" />
      <div className="relative mt-auto space-y-[2cqw]">
        <Kicker>Próximos passos</Kicker>
        <Title size="xl">{content.closing || title}</Title>
        {contacts.length ? <p className="text-[1.6cqw] opacity-75">{contacts.join("   ·   ")}</p> : null}
      </div>
      <span className="absolute bottom-0 left-0 h-[0.5cqw] w-full" style={{ background: content.accent }} />
    </Slide>
  );
}

// ---------------------------------------------------------------------------
// Modelos
// ---------------------------------------------------------------------------

function ManifestoDeck({ data }: { data: DeckData }) {
  const { profile, content, budget } = data;
  const manifesto = lines(profile.manifesto).length ? lines(profile.manifesto) : FALLBACK_MANIFESTO;
  let page = 0;
  const next = () => ++page;
  const slides = [
    <Cover key="cover" data={data} page={next()} variant="manifesto" />,
    <Slide key="manifesto" accent={content.accent} page={next()} client={budget.clientName}>
      <Kicker>Manifesto</Kicker>
      <div className="mt-auto mb-[4cqw] space-y-[0.6cqw]">
        {manifesto.map((line, index) => (
          <p key={line} className="font-display text-[4.2cqw] font-black leading-[1.05] tracking-tight" style={index === manifesto.length - 1 ? { color: content.accent } : undefined}>
            {line}
          </p>
        ))}
      </div>
    </Slide>,
    profile.founderName ? <Founder key="founder" data={data} page={next()} /> : null,
    content.context ? <TextSlide key="challenge" data={data} page={next()} kicker="O desafio" title="Onde estamos" text={content.context} /> : null,
    content.concept || content.objective ? (
      <TextSlide key="idea" data={data} page={next()} kicker="A ideia" title="Para onde vamos" text={[content.concept, content.objective && `Objetivo: ${content.objective}`].filter(Boolean).join("\n\n")} />
    ) : null,
    content.references.length ? <References key="refs" data={data} page={next()} /> : null,
    budget.deliverables.length ? <Deliverables key="deliv" data={data} page={next()} /> : null,
    content.timeline.length ? <Timeline key="time" data={data} page={next()} /> : null,
    <Investment key="invest" data={data} page={next()} />,
    <Closing key="close" data={data} page={next()} />,
  ];
  return <>{slides}</>;
}

function ExecutiveDeck({ data }: { data: DeckData }) {
  const { profile, content, budget } = data;
  let page = 0;
  const next = () => ++page;
  const clients = profile.clients
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return (
    <>
      <Cover data={data} page={next()} variant="executivo" />
      <Slide accent={content.accent} page={next()} client={budget.clientName}>
        <div className="grid h-full min-h-0 grid-cols-[3fr_2fr] gap-[5cqw]">
          <div className="flex min-h-0 flex-col justify-center space-y-[1.8cqw]">
            <Kicker>Quem somos</Kicker>
            <Title size="md">Além Filmes</Title>
            <Body size={fitBody(profile.about || FALLBACK_ABOUT, 1.45)}>{profile.about || FALLBACK_ABOUT}</Body>
            {profile.proof ? (
              <p className="text-balance font-display text-[2cqw] font-black leading-tight" style={{ color: content.accent }}>
                {profile.proof}
              </p>
            ) : null}
            {clients.length ? <p className="text-[1.05cqw] uppercase leading-relaxed tracking-[0.2em] opacity-60">{clients.join("  ·  ")}</p> : null}
          </div>
          {profile.founderName ? (
            <div className="flex min-h-0 flex-col justify-center gap-[1.4cqw] border-l border-[color:var(--line)] pl-[4cqw]">
              <div className="relative aspect-[4/5] w-full max-w-[19cqw] overflow-hidden rounded-[0.8cqw]">
                <FounderPhoto name={profile.founderName} className="absolute inset-0 size-full" />
                <span aria-hidden className="absolute inset-x-0 bottom-0 h-[0.35cqw]" style={{ background: content.accent }} />
              </div>
              <div className="space-y-[0.5cqw]">
                <p className="text-[1cqw] font-bold uppercase tracking-[0.25em]" style={{ color: content.accent }}>
                  A mente por trás
                </p>
                <p className="font-display text-[2.2cqw] font-black leading-tight">{profile.founderName}</p>
                <p className="text-[1.1cqw] uppercase tracking-[0.2em] opacity-60">{profile.founderRole}</p>
              </div>
            </div>
          ) : null}
        </div>
      </Slide>
      {content.objective || content.context ? (
        <TextSlide data={data} page={next()} kicker="Objetivo" title="O que vamos resolver" text={[content.objective, content.context].filter(Boolean).join("\n\n")} />
      ) : null}
      {budget.deliverables.length || content.concept ? (
        <Slide accent={content.accent} page={next()} client={budget.clientName}>
          <div className="grid h-full grid-cols-2 gap-[6cqw]">
            <div className="flex flex-col justify-center space-y-[2cqw]">
              <Kicker>Escopo</Kicker>
              <Title size="md">Como vamos fazer</Title>
              {content.concept ? <Body size={fitBody(content.concept, 1.45)}>{content.concept}</Body> : null}
            </div>
            <ol className="flex flex-col justify-center space-y-[1.2cqw]">
              {budget.deliverables.map((entry, index) => (
                <li key={entry.item} className="flex items-baseline gap-[1.6cqw] border-b border-[color:var(--line)] pb-[1cqw]">
                  <span className="font-display text-[1.5cqw] font-black" style={{ color: content.accent }}>
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="text-[1.7cqw]">
                    {entry.item}
                    {entry.deadline ? <span className="block text-[1.1cqw] uppercase tracking-[0.15em] opacity-60">Prazo: {entry.deadline}</span> : null}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </Slide>
      ) : null}
      <Team data={data} page={next()} />
      {content.timeline.length ? <Timeline data={data} page={next()} /> : null}
      <Investment data={data} page={next()} />
      <Closing data={data} page={next()} title="Prontos para começar." />
    </>
  );
}

function TreatmentDeck({ data }: { data: DeckData }) {
  const { profile, content, budget } = data;
  let page = 0;
  const next = () => ++page;
  return (
    <>
      <Cover data={data} page={next()} variant="tratamento" />
      <Slide accent={content.accent} page={next()} client={budget.clientName}>
        <div className="grid h-full min-h-0 grid-cols-[3fr_2fr] gap-[5cqw]">
          <div className="flex min-h-0 flex-col justify-center space-y-[2cqw]">
            <Kicker>A Além</Kicker>
            <Title size="md">{profile.tagline}</Title>
            <Body size={fitBody(profile.about || FALLBACK_ABOUT, 1.5)}>{profile.about || FALLBACK_ABOUT}</Body>
            {profile.proof ? (
              <p className="text-balance font-display text-[2cqw] font-black leading-tight" style={{ color: content.accent }}>
                {profile.proof}
              </p>
            ) : null}
          </div>
          {profile.founderName ? (
            <div className="flex min-h-0 flex-col justify-center gap-[1.4cqw] border-l border-[color:var(--line)] pl-[4cqw]">
              <div className="relative aspect-[4/5] w-full max-w-[19cqw] overflow-hidden rounded-[0.8cqw]">
                <FounderPhoto name={profile.founderName} className="absolute inset-0 size-full" />
                <span aria-hidden className="absolute inset-x-0 bottom-0 h-[0.35cqw]" style={{ background: content.accent }} />
              </div>
              <div className="space-y-[0.5cqw]">
                <p className="text-[1cqw] font-bold uppercase tracking-[0.25em]" style={{ color: content.accent }}>
                  Direção
                </p>
                <p className="font-display text-[2.2cqw] font-black leading-tight">{profile.founderName}</p>
                <p className="text-[1.1cqw] uppercase tracking-[0.2em] opacity-60">{profile.founderRole}</p>
              </div>
            </div>
          ) : null}
        </div>
      </Slide>
      {profile.founderName && profile.founderBio ? <Founder data={data} page={next()} kicker="O diretor" /> : null}
      {content.concept ? (
        <Slide accent={content.accent} page={next()} client={budget.clientName} tone="alt">
          <div className="mx-auto flex h-full max-w-[80%] flex-col justify-center space-y-[2.4cqw]">
            <Kicker>Carta do diretor</Kicker>
            <p className="whitespace-pre-line font-display font-black leading-[1.25] tracking-tight" style={{ fontSize: fitBody(content.concept, 2.2) }}>
              {content.concept}
            </p>
            {profile.founderName ? <p className="text-[1.4cqw] uppercase tracking-[0.25em] opacity-70">— {profile.founderName}</p> : null}
          </div>
        </Slide>
      ) : null}
      {content.context || content.objective ? (
        <TextSlide data={data} page={next()} kicker="Contexto e público" title="Para quem falamos" text={[content.context, content.objective].filter(Boolean).join("\n\n")} />
      ) : null}
      {content.narrative ? <TextSlide data={data} page={next()} kicker="Narrativa" title="Como o filme se desenvolve" text={content.narrative} /> : null}
      {content.references.length ? <References data={data} page={next()} kicker="Linguagem visual" title="Luz, cor e ritmo" /> : null}
      <Team data={data} page={next()} kicker="Produção" title="Equipe e estrutura" />
      {content.timeline.length ? <Timeline data={data} page={next()} /> : null}
      {budget.deliverables.length ? <Deliverables data={data} page={next()} /> : null}
      <Investment data={data} page={next()} />
      <Closing data={data} page={next()} title="Até o set." />
    </>
  );
}

export function ProposalDeck(data: DeckData) {
  if (data.content.template === "executivo") return <ExecutiveDeck data={data} />;
  if (data.content.template === "tratamento") return <TreatmentDeck data={data} />;
  return <ManifestoDeck data={data} />;
}
