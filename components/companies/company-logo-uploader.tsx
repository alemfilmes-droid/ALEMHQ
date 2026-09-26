"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { setCompanyLogoAction } from "@/app/(app)/clientes/actions";
import { ClientAvatar } from "@/components/companies/client-avatar";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { IMAGE_ACCEPT, IMAGE_MAX_LABEL, IMAGE_TYPES, describeUploadError, validateImage } from "@/lib/uploads";
import { cn } from "@/lib/utils";

const BUCKET = "company-logos";

interface CompanyLogoUploaderProps {
  companyId: string;
  companyName: string;
  logoUrl: string | null;
  /** "compact": só o logo, clicável (cabeçalho do cliente). "full": logo + botões (formulário). */
  variant?: "compact" | "full";
}

/** Envia para {company_id}/logo.{ext} no bucket público; limites em lib/uploads.ts (5 MB, JPG/PNG/WebP). */
export function CompanyLogoUploader({ companyId, companyName, logoUrl, variant = "full" }: CompanyLogoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const busy = uploading || pending;

  async function removeStoredFiles(supabase: ReturnType<typeof createClient>, keep?: string) {
    const { data } = await supabase.storage.from(BUCKET).list(companyId);
    const stale = (data ?? []).filter((file) => file.name !== keep).map((file) => `${companyId}/${file.name}`);
    if (stale.length > 0) await supabase.storage.from(BUCKET).remove(stale);
  }

  async function handleFile(file: File) {
    const invalid = validateImage(file);
    if (invalid) {
      toast.error(invalid);
      return;
    }
    const extension = IMAGE_TYPES[file.type];

    setUploading(true);
    const supabase = createClient();
    const fileName = `logo.${extension}`;
    const path = `${companyId}/${fileName}`;

    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true, contentType: file.type });
    if (error) {
      setUploading(false);
      toast.error(describeUploadError(error));
      return;
    }
    await removeStoredFiles(supabase, fileName);

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    // Parâmetro de versão evita cache da imagem anterior.
    const result = await setCompanyLogoAction(companyId, `${data.publicUrl}?v=${Date.now()}`);
    setUploading(false);
    if (!result.ok) return toast.error(result.error);
    toast.success(result.message);
    startTransition(() => router.refresh());
  }

  async function handleRemove() {
    setUploading(true);
    await removeStoredFiles(createClient());
    const result = await setCompanyLogoAction(companyId, null);
    setUploading(false);
    if (!result.ok) return toast.error(result.error);
    toast.success(result.message);
    startTransition(() => router.refresh());
  }

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept={IMAGE_ACCEPT}
      className="sr-only"
      aria-label="Selecionar logo do cliente"
      tabIndex={-1}
      onChange={(event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (file) void handleFile(file);
      }}
    />
  );

  if (variant === "compact") {
    return (
      <>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          title={logoUrl ? "Trocar logo" : "Enviar logo"}
          aria-label={logoUrl ? `Trocar logo de ${companyName}` : `Enviar logo de ${companyName}`}
          className={cn(
            "group relative block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring",
            busy && "cursor-wait",
          )}
        >
          <ClientAvatar name={companyName} logoUrl={logoUrl} size="lg" />
          <span
            className={cn(
              "absolute inset-0 flex items-center justify-center rounded-lg bg-background/70 transition-opacity",
              busy ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100",
            )}
          >
            {busy ? <Loader2 className="size-5 animate-spin" aria-label="Enviando o logo" /> : <ImagePlus className="size-5" aria-hidden />}
          </span>
        </button>
        {input}
      </>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <ClientAvatar name={companyName} logoUrl={logoUrl} size="lg" />
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" size="sm" loading={busy} onClick={() => inputRef.current?.click()}>
            <ImagePlus aria-hidden />
            {logoUrl ? "Trocar logo" : "Enviar logo"}
          </Button>
          {logoUrl ? (
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={handleRemove}>
              <Trash2 aria-hidden />
              Remover
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-subtle" aria-live="polite">{uploading ? "Enviando o logo…" : `Quadrado, sem corte. JPG, PNG ou WebP, até ${IMAGE_MAX_LABEL}.`}</p>
        {input}
      </div>
    </div>
  );
}
