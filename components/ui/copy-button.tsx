"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";

/** Copia um texto para a área de transferência, com confirmação visual. */
export function CopyButton({
  value,
  label = "Copiar",
  copiedMessage = "Copiado.",
  size = "sm",
  variant = "secondary",
  className,
}: { value: string; label?: string; copiedMessage?: string } & Pick<ButtonProps, "size" | "variant" | "className">) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      className={className}
      onClick={() => {
        void navigator.clipboard.writeText(value).then(
          () => {
            setCopied(true);
            toast.success(copiedMessage);
            window.setTimeout(() => setCopied(false), 1800);
          },
          () => toast.error("Não foi possível copiar. Selecione o texto e copie à mão."),
        );
      }}
    >
      {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
      {label}
    </Button>
  );
}
