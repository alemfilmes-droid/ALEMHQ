import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs [&_svg]:size-3",
  {
    variants: {
      variant: {
        outline: "border-border-strong font-semibold text-muted-foreground",
        solid: "border-transparent bg-foreground font-bold text-background",
        muted: "border-border bg-surface-hover font-semibold text-muted-foreground",
      },
    },
    defaultVariants: { variant: "outline" },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge };
