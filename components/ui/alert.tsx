import * as React from "react";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS = { error: AlertCircle, success: CheckCircle2, info: Info } as const;

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Estados são comunicados por ícone, rótulo e peso — nunca por cor. */
  variant?: keyof typeof ICONS;
  title?: string;
}

function Alert({ variant = "info", title, className, children, ...props }: AlertProps) {
  const Icon = ICONS[variant];
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn(
        "flex gap-3 rounded-md border bg-surface-raised p-3 text-sm",
        variant === "error" ? "border-2 border-foreground" : "border-border-strong",
        className,
      )}
      {...props}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="space-y-0.5">
        {title ? <p className="font-bold text-foreground">{title}</p> : null}
        <div className={variant === "error" ? "font-semibold text-foreground" : "text-muted-foreground"}>
          {children}
        </div>
      </div>
    </div>
  );
}

export { Alert };
