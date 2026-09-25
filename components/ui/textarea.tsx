import * as React from "react";
import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-24 w-full rounded-md border border-input bg-surface-raised px-3 py-2 text-sm text-foreground placeholder:text-subtle transition-colors hover:border-subtle disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-2 aria-[invalid=true]:border-foreground",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

export { Textarea };
