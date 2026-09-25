import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-surface-raised px-3 text-sm text-foreground placeholder:text-subtle transition-colors hover:border-subtle disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-2 aria-[invalid=true]:border-foreground read-only:text-muted-foreground",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export { Input };
