"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { updateAvatarAction } from "@/app/(app)/perfil/actions";
import { UserAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { IMAGE_ACCEPT, IMAGE_MAX_LABEL, IMAGE_TYPES, describeUploadError, validateImage } from "@/lib/uploads";

interface AvatarUploaderProps {
  userId: string;
  name: string;
  avatarUrl: string | null;
}

export function AvatarUploader({ userId, name, avatarUrl }: AvatarUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const busy = uploading || pending;

  async function removeStoredFiles(supabase: ReturnType<typeof createClient>, keep?: string) {
    const { data } = await supabase.storage.from("avatars").list(userId);
    const stale = (data ?? []).filter((file) => file.name !== keep).map((file) => `${userId}/${file.name}`);
    if (stale.length > 0) await supabase.storage.from("avatars").remove(stale);
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
    const fileName = `avatar.${extension}`;
    const path = `${userId}/${fileName}`;

    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
    if (error) {
      setUploading(false);
      toast.error(describeUploadError(error));
      return;
    }
    await removeStoredFiles(supabase, fileName);

    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    // Parâmetro de versão evita cache da imagem anterior.
    const result = await updateAvatarAction(`${data.publicUrl}?v=${Date.now()}`);
    setUploading(false);

    if (result.ok) {
      toast.success(result.message);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  async function handleRemove() {
    setUploading(true);
    await removeStoredFiles(createClient());
    const result = await updateAvatarAction(null);
    setUploading(false);
    if (result.ok) {
      toast.success(result.message);
      startTransition(() => router.refresh());
    } else {
      toast.error(result.error);
    }
  }

  return (
    <div className="flex items-center gap-5">
      <UserAvatar name={name} src={avatarUrl} profileId={userId} className="size-20 text-lg" />
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" size="sm" loading={busy} onClick={() => inputRef.current?.click()}>
            <ImagePlus aria-hidden />
            {avatarUrl ? "Trocar foto" : "Enviar foto"}
          </Button>
          {avatarUrl ? (
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={handleRemove}>
              <Trash2 aria-hidden />
              Remover
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-subtle" aria-live="polite">{uploading ? "Enviando a foto…" : `JPG, PNG ou WebP. Até ${IMAGE_MAX_LABEL}.`}</p>
        <input
          ref={inputRef}
          type="file"
          accept={IMAGE_ACCEPT}
          className="sr-only"
          aria-label="Selecionar foto de perfil"
          tabIndex={-1}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void handleFile(file);
          }}
        />
      </div>
    </div>
  );
}
