/** Lado maior de foto/logo salva: 512 px cobre o maior uso (avatar do perfil) em tela retina. */
export const STORED_IMAGE_MAX_SIDE = 512;

/** Dimensões que cabem em `max` mantendo a proporção; nunca aumenta a imagem. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/**
 * Reduz a imagem no aparelho antes de enviar (só no navegador). Logo com transparência continua PNG;
 * foto vira JPEG. Se o navegador não conseguir ler a imagem, envia a original (a validação de
 * tamanho continua valendo).
 */
export async function downscaleImage(file: File, max = STORED_IMAGE_MAX_SIDE): Promise<File> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }
  const target = fitWithin(bitmap.width, bitmap.height, max);
  if (target.width === bitmap.width && target.height === bitmap.height) {
    bitmap.close();
    return file;
  }
  const canvas = document.createElement("canvas");
  canvas.width = target.width;
  canvas.height = target.height;
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, target.width, target.height);
  bitmap.close();

  const type = file.type === "image/png" ? "image/png" : "image/jpeg";
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.85));
  if (!blob) return file;
  return new File([blob], file.name.replace(/\.\w+$/, type === "image/png" ? ".png" : ".jpg"), { type });
}
