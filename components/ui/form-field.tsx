import * as React from "react";
import { AlertCircle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface FormFieldProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}

/** Rótulo + controle + dica/erro. O controle deve usar o mesmo `id` e aria-describedby `${id}-message`. */
function FormField({ id, label, error, hint, className, children }: FormFieldProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p id={`${id}-message`} className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
          <AlertCircle className="size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-message`} className="text-[13px] text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export { FormField };
