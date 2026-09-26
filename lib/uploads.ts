/**
 * Regras de upload de imagem (fotos da equipe e logos de clientes). Os mesmos limites estão nos
 * buckets do Supabase Storage (file_size_limit e allowed_mime_types — ver a migração
 * 20260928090000): a validação daqui só evita a viagem e dá uma mensagem clara.
 */
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const IMAGE_MAX_LABEL = "5 MB";
export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";
export const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function formatSize(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}

/** null = ok; senão, a mensagem para a pessoa. */
export function validateImage(file: File): string | null {
  if (!IMAGE_TYPES[file.type]) return `Formato não aceito (${file.type || "desconhecido"}). Use JPG, PNG ou WebP.`;
  if (file.size > IMAGE_MAX_BYTES) return `A imagem tem ${formatSize(file.size)}; o limite é ${IMAGE_MAX_LABEL}.`;
  return null;
}

/** Traduz o erro do Storage para uma mensagem útil (o genérico escondia a causa). */
export function describeUploadError(error: { message: string }): string {
  const message = error.message.toLowerCase();
  if (message.includes("exceeded the maximum allowed size") || message.includes("payload too large")) {
    return `A imagem passa do limite de ${IMAGE_MAX_LABEL}.`;
  }
  if (message.includes("mime type") || message.includes("invalid_mime_type")) return "Formato não aceito. Use JPG, PNG ou WebP.";
  if (message.includes("row-level security") || message.includes("unauthorized") || message.includes("not authorized")) {
    return "Você não tem permissão para enviar esta imagem.";
  }
  if (message.includes("bucket not found")) return "O armazenamento de imagens não está configurado. Avise a administração.";
  if (message.includes("fetch") || message.includes("network")) return "Falha de conexão durante o envio. Tente de novo.";
  return `Não foi possível enviar a imagem (${error.message}).`;
}
