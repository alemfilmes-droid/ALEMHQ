/**
 * Fotos e logos são salvas no tamanho enviado (até 2 MB, ex.: foto de 12 MP do iPhone). Decodificada,
 * cada uma ocupa ~48 MB de memória, mesmo aparecendo em 36 px — no app do iPhone isso fazia o iOS
 * fechar o HQ nas telas com muitos cards. Aqui a imagem do Storage passa pelo otimizador de imagens
 * do Next/Vercel (já incluso, sem serviço novo) no tamanho em que aparece.
 */

/** Larguras que o otimizador aceita (imageSizes padrão do Next) — 1x e 2x do avatar. */
export const THUMBNAIL_WIDTHS = { x1: 96, x2: 256 } as const;

/** Só imagens públicas do nosso Storage passam pelo otimizador (as demais vão como estão). */
export function isStorageImage(src: string, supabaseUrl: string): boolean {
  return src.startsWith(`${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/`);
}

function optimizerUrl(src: string, width: number): string {
  return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=75`;
}

/** src + srcSet já reduzidos para avatar/logo; fora do Storage, devolve a imagem original. */
export function thumbnailSource(src: string, supabaseUrl: string): { src: string; srcSet?: string } {
  if (!isStorageImage(src, supabaseUrl)) return { src };
  return {
    src: optimizerUrl(src, THUMBNAIL_WIDTHS.x1),
    srcSet: `${optimizerUrl(src, THUMBNAIL_WIDTHS.x1)} 1x, ${optimizerUrl(src, THUMBNAIL_WIDTHS.x2)} 2x`,
  };
}
