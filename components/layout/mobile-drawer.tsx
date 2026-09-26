"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { BrandLogo } from "@/components/layout/brand-logo";
import { NavList } from "@/components/layout/nav-list";
import type { NavGroup } from "@/lib/navigation";

interface MobileDrawerProps {
  groups: NavGroup[];
  badges: Record<string, number>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileDrawer({ groups, badges, open, onOpenChange }: MobileDrawerProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/70 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 md:hidden" />
        <DialogPrimitive.Content
          className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-border bg-surface duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left md:hidden"
          aria-describedby={undefined}
        >
          <DialogPrimitive.Title className="sr-only">Menu</DialogPrimitive.Title>
          <div className="flex items-start justify-between px-6 pb-8 pt-10">
            <BrandLogo />
            <DialogPrimitive.Close className="rounded-sm p-1 text-muted-foreground hover:text-foreground">
              <X className="size-5" aria-hidden />
              <span className="sr-only">Fechar menu</span>
            </DialogPrimitive.Close>
          </div>
          <NavList groups={groups} badges={badges} onNavigate={() => onOpenChange(false)} />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
