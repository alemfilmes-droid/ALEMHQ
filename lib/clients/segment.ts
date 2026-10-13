/**
 * Segmento do cliente: lista fixa + "Outro" com texto livre. Gravado como texto em companies.segment (a mesma
 * coluna que o CRM já preenche) — a opção da lista vai com o rótulo exato; "Outro" grava o texto digitado.
 */

export const SEGMENTS = [
  "Educação",
  "Saúde",
  "Imobiliário",
  "Agro",
  "Varejo",
  "Serviços",
  "Eventos",
  "Tecnologia",
  "Contabilidade/Finanças",
  "Político",
  "Terceiro setor",
] as const;
export type Segment = (typeof SEGMENTS)[number];

export const OTHER_SEGMENT = "Outro";
/** Valor de filtro para "Outro" na URL (?segmento=outro). */
export const OTHER_SEGMENT_KEY = "outro";

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
}

/** Opção da lista que corresponde ao texto gravado (sem diferenciar maiúsculas/acentos). */
export function knownSegment(value: string | null | undefined): Segment | null {
  if (!value) return null;
  const key = normalize(value);
  return SEGMENTS.find((segment) => normalize(segment) === key) ?? null;
}

/** Texto gravado → o que o formulário mostra: a opção da lista, ou "Outro" + o texto. */
export function segmentChoice(value: string | null | undefined): { option: Segment | typeof OTHER_SEGMENT | ""; custom: string } {
  const text = (value ?? "").trim();
  if (!text) return { option: "", custom: "" };
  const known = knownSegment(text);
  if (known) return { option: known, custom: "" };
  return { option: OTHER_SEGMENT, custom: normalize(text) === normalize(OTHER_SEGMENT) ? "" : text };
}

/** Formulário → texto gravado ("" = não informado). "Outro" sem texto grava "Outro". */
export function segmentValue(option: string, custom: string): string {
  if (!option) return "";
  if (option === OTHER_SEGMENT) return custom.trim() || OTHER_SEGMENT;
  return option;
}

/** Filtro da lista de clientes: uma opção da lista, ou "outro" (qualquer texto fora da lista). */
export function matchesSegmentFilter(filter: string, value: string | null | undefined): boolean {
  if (filter === OTHER_SEGMENT_KEY) return Boolean(value?.trim()) && knownSegment(value) === null;
  const known = knownSegment(filter);
  return known !== null && knownSegment(value) === known;
}
