import { createClient } from "@/lib/supabase/client";

/**
 * Arquivo da nota fiscal (PDF, XML ou imagem) no bucket privado "invoices". Os limites repetem os do
 * bucket (migração 20261004110000): a validação daqui só dá a mensagem clara antes do envio.
 */
export const INVOICE_FILE_ACCEPT = "application/pdf,application/xml,text/xml,.xml,image/jpeg,image/png";
const INVOICE_MAX_BYTES = 10 * 1024 * 1024;
const TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "application/xml": "xml",
  "text/xml": "xml",
  "image/jpeg": "jpg",
  "image/png": "png",
};

function extensionOf(file: File): string | null {
  if (TYPES[file.type]) return TYPES[file.type] ?? null;
  // Alguns sistemas mandam o XML da NFS-e sem tipo.
  return /\.xml$/i.test(file.name) ? "xml" : null;
}

/** Envia o arquivo e devolve o caminho no bucket. `folder`: "receivables/<id>" ou "issuances/<id>". */
export async function uploadInvoiceFile(folder: string, file: File): Promise<string> {
  const extension = extensionOf(file);
  if (!extension) throw new Error("Formato não aceito. Use PDF, XML, JPG ou PNG.");
  if (file.size > INVOICE_MAX_BYTES) throw new Error("O arquivo passa de 10 MB.");
  const supabase = createClient();
  const path = `${folder}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${extension}`;
  const { error } = await supabase.storage
    .from("invoices")
    .upload(path, file, { contentType: extension === "xml" ? "application/xml" : file.type });
  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("row-level security") || message.includes("unauthorized")) throw new Error("Só o financeiro e a diretoria anexam notas.");
    if (message.includes("bucket not found")) throw new Error("O armazenamento de notas ainda não foi configurado (falta aplicar a migração).");
    throw new Error(`Não foi possível enviar a nota (${error.message}).`);
  }
  return path;
}
