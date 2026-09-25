import * as React from "react";
import { cn } from "@/lib/utils";

/** <select> nativo com o visual de Input — para formulários controlados por react-hook-form (register). */
const NativeSelect = React.forwardRef<HTMLSelectElement, React.ComponentProps<"select">>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "flex h-10 w-full rounded-md border border-input bg-surface-raised px-3 text-sm text-foreground transition-colors hover:border-subtle disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-2 aria-[invalid=true]:border-foreground",
      className,
    )}
    {...props}
  >
    {children}
  </select>
));
NativeSelect.displayName = "NativeSelect";

export { NativeSelect };
