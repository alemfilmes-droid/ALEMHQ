/**
 * Essência da Além Filmes — Manifesto, Valores e Cultura.
 *
 * Por que um arquivo TypeScript tipado (e não uma tabela semeada):
 * - É texto institucional que muda raramente e merece revisão como código (diff, histórico, PR).
 * - Renderiza estaticamente, sem consulta ao banco nem RLS para um conteúdo que todos leem.
 * - O caminho de edição fica preparado: o formato abaixo (EssenciaDocument) é exatamente o de uma
 *   futura tabela `essence_documents` (slug, título, seções em JSON), a leitura passa só por
 *   getEssenciaDocument() e a permissão já existe (capability "manageCompany" = diretoria/master).
 *   Quando a edição for construída, basta trocar a fonte dentro dessa função.
 *
 * Fontes: docs/Alem_Filmes_Manifesto.pdf e docs/Alem_Filmes_Proposito_Missao_Valores.pdf. Os textos
 * são os dos documentos; "Cultura" não tem documento próprio — foi organizada a partir desses dois,
 * citando-os literalmente.
 */

export const ESSENCIA_SLUGS = ["manifesto", "valores", "cultura"] as const;
export type EssenciaSlug = (typeof ESSENCIA_SLUGS)[number];

export interface EssenciaItem {
  number: string;
  title: string;
  text: string;
}

export interface EssenciaSection {
  number: string;
  title: string;
  /** Subtítulo curto em caixa alta (ex.: "Externa"). */
  eyebrow?: string;
  paragraphs: string[];
  items?: EssenciaItem[];
}

export interface EssenciaDocument {
  slug: EssenciaSlug;
  title: string;
  /** Complemento do título no card da home: "por que existimos". */
  kicker: string;
  /** Uma frase para o card da home. */
  summary: string;
  /** Frase de abertura em destaque. */
  lead: string[];
  quote: { lines: string[]; attribution: string };
  sections: EssenciaSection[];
  closing: string[];
  source: string;
}

const DOCUMENTS: Record<EssenciaSlug, EssenciaDocument> = {
  manifesto: {
    slug: "manifesto",
    title: "Manifesto",
    kicker: "por que existimos",
    summary: "A gente não entrega vídeo. A gente entrega além.",
    lead: ["A gente não entrega vídeo.", "A gente entrega além."],
    quote: {
      lines: ["Confiança não se promete.", "Se constrói."],
      attribution: "Prazo depois de prazo, cena depois de cena.",
    },
    sections: [
      {
        number: "01",
        title: "Além do que você pediu",
        paragraphs: [
          "Além do que você pediu. Além do que você esperava. Além do que você imaginou que fosse possível caber numa tela.",
          "Você chega com um roteiro na cabeça. A gente devolve uma história inteira.",
          "Você pede um vídeo bonito. A gente entrega impacto.",
        ],
      },
      {
        number: "02",
        title: "Impacto é autoral",
        paragraphs: [
          "Porque bonito, qualquer câmera boa entrega. Impacto, só entrega quem trata o seu projeto como se fosse autoral nosso — cada ideia, cada cena, cuidada com o mesmo zelo de quem assina o próprio nome nela.",
          "Isso não é discurso. É repetição. Entrega após entrega, cliente após cliente — a gente supera o combinado. Sempre.",
        ],
      },
      {
        number: "03",
        title: "O peso do que está em jogo",
        paragraphs: [
          "E é assim porque a gente entende o peso do que está em jogo. Quando alguém coloca sua mensagem, sua marca, sua causa nas nossas mãos, a gente carrega isso com responsabilidade.",
          "Não é só um projeto na prateleira. É a voz de alguém que confiou em nós pra chegar mais longe.",
        ],
      },
      {
        number: "04",
        title: "É por isso que",
        paragraphs: [],
        items: [
          { number: "01", title: "Cumprimos", text: "Cumprimos o que combinamos. Sempre." },
          {
            number: "02",
            title: "Conquistamos",
            text: "Conquistamos o nosso espaço — não empurrando ninguém, mas chegando com peso, com autoridade, com trabalho que fala por si.",
          },
          { number: "03", title: "Ousamos", text: "Somos ousados. A gente sabe o que é capaz de fazer, e vai lá e faz." },
          {
            number: "04",
            title: "Multiplicamos",
            text: "Clientes em parceiros. Talentos em profissionais. Uma produtora em Natal numa marca que vai ocupar cada capital, cada cidade, cada canto do Brasil que tiver uma história esperando pra ser contada.",
          },
        ],
      },
    ],
    closing: ["A nossa visão é além do óbvio.", "A gente não quer só ser visto.", "Quer construir algo impossível de ser ignorado.", "Sempre além."],
    source: "Manifesto — Além Filmes",
  },

  valores: {
    slug: "valores",
    title: "Valores",
    kicker: "o que nos guia",
    summary: "Propósito, missão e os quatro valores que decidem como a Além age.",
    lead: ["Visão além do óbvio."],
    quote: {
      lines: ["Construir algo impossível de ser ignorado."],
      attribution: "Propósito — Além Filmes",
    },
    sections: [
      {
        number: "01",
        title: "Propósito",
        paragraphs: [
          "Ser uma produtora audiovisual que gera impacto real na vida das pessoas — não a reação passageira de um vídeo bonito, mas a conexão que fica.",
          "Pegar um projeto na mesa e desenvolver, do roteiro à pós-produção, um material que carregue a responsabilidade de quem confiou na gente pra ir além do esperado.",
          "Construir algo impossível de ser ignorado.",
        ],
      },
      {
        number: "02",
        title: "Missão",
        paragraphs: [],
        items: [
          {
            number: "Externa",
            title: "Para o mercado",
            text: "Tornar-se a maior produtora audiovisual do Brasil — referência em confiança, prazo, qualidade, tecnologia e rapidez.",
          },
          {
            number: "Interna",
            title: "Para as pessoas",
            text: "Gerar oportunidades. Pegar pessoas que ainda não descobriram no que são boas e transformar sua realidade — financeira e mental — através do trabalho na Além.",
          },
        ],
      },
      {
        number: "03",
        title: "Valores",
        paragraphs: [],
        items: [
          { number: "01", title: "Cumprir combinados", text: "A palavra dada é compromisso." },
          {
            number: "02",
            title: "Conquistar",
            text: "Chegar com peso e autoridade no mercado, conquistando espaço através do trabalho — nunca por cima de alguém.",
          },
          { number: "03", title: "Ousadia", text: "Confiança pra dizer \"eu sou bom, eu vou fazer\" — e ir lá e fazer." },
          {
            number: "04",
            title: "Multiplicar",
            text: "Clientes em parceiros, talentos em profissionais, uma produtora em Natal numa marca em cada capital do Brasil.",
          },
        ],
      },
    ],
    closing: ["Sempre além."],
    source: "Propósito · Missão · Valores — documento interno",
  },

  cultura: {
    slug: "cultura",
    title: "Cultura",
    kicker: "como trabalhamos",
    summary: "O jeito Além de trabalhar, no dia a dia: combinado, autoria, prazo e gente crescendo.",
    lead: ["Isso não é discurso.", "É repetição."],
    quote: {
      lines: ["A palavra dada é compromisso."],
      attribution: "Valor 01 — Cumprir combinados",
    },
    sections: [
      {
        number: "01",
        title: "Tratamos cada projeto como autoral",
        paragraphs: [
          "Cada ideia, cada cena, cuidada com o mesmo zelo de quem assina o próprio nome nela.",
          "Você chega com um roteiro na cabeça. A gente devolve uma história inteira.",
        ],
      },
      {
        number: "02",
        title: "O combinado é o mínimo",
        paragraphs: [
          "Cumprimos o que combinamos. Sempre.",
          "Entrega após entrega, cliente após cliente — a gente supera o combinado. Sempre.",
        ],
      },
      {
        number: "03",
        title: "Do roteiro à pós, com responsabilidade",
        paragraphs: [
          "Pegar um projeto na mesa e desenvolver, do roteiro à pós-produção, um material que carregue a responsabilidade de quem confiou na gente pra ir além do esperado.",
          "Não é só um projeto na prateleira. É a voz de alguém que confiou em nós pra chegar mais longe.",
        ],
      },
      {
        number: "04",
        title: "Confiança se constrói no prazo",
        paragraphs: [
          "Confiança não se promete. Se constrói. Prazo depois de prazo, cena depois de cena.",
          "Referência em confiança, prazo, qualidade, tecnologia e rapidez.",
        ],
      },
      {
        number: "05",
        title: "Ousadia com trabalho que fala por si",
        paragraphs: [
          "Somos ousados. A gente sabe o que é capaz de fazer, e vai lá e faz.",
          "Conquistamos espaço através do trabalho — nunca por cima de alguém.",
        ],
      },
      {
        number: "06",
        title: "Aqui, gente cresce",
        paragraphs: [
          "Gerar oportunidades. Pegar pessoas que ainda não descobriram no que são boas e transformar sua realidade — financeira e mental — através do trabalho na Além.",
          "Talentos em profissionais.",
        ],
      },
    ],
    closing: ["Sempre além."],
    source: "Organizada a partir do Manifesto e do documento Propósito · Missão · Valores",
  },
};

export function isEssenciaSlug(value: string): value is EssenciaSlug {
  return (ESSENCIA_SLUGS as readonly string[]).includes(value);
}

/** Único ponto de leitura — quando houver edição pela diretoria, a fonte muda só aqui. */
export async function getEssenciaDocument(slug: EssenciaSlug): Promise<EssenciaDocument> {
  return DOCUMENTS[slug];
}

export async function listEssenciaDocuments(): Promise<EssenciaDocument[]> {
  return ESSENCIA_SLUGS.map((slug) => DOCUMENTS[slug]);
}
