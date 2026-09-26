"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { ContactPanelDialog } from "@/components/companies/contact-panel-dialog";
import { UserAvatar } from "@/components/ui/avatar";
import type { Contact } from "@/types";

interface ContactCardProps {
  contact: Contact;
  canManage: boolean;
}

/** Card clicável: abre o painel com telefone/WhatsApp, e-mail e edição inline. */
export function ContactCard({ contact, canManage }: ContactCardProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-border-strong hover:bg-surface-raised"
      >
        <UserAvatar name={contact.full_name} plain className="size-9" />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-sm font-bold">
            {contact.full_name}
            {contact.is_decision_maker ? <Star className="size-3.5 shrink-0 text-subtle" aria-label="Decisor(a)" /> : null}
          </p>
          <p className="truncate text-[13px] text-muted-foreground">{contact.job_title ?? "Sem cargo"}</p>
        </div>
      </button>

      {open ? <ContactPanelDialog contact={contact} canManage={canManage} open={open} onOpenChange={setOpen} /> : null}
    </>
  );
}
