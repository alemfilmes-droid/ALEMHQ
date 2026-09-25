"use client";

import { useTransition } from "react";
import { Clock, MailX, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { resendInvitationAction, revokeInvitationAction } from "@/app/(app)/equipe/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FUNCTION_LABELS, ROLE_LABELS } from "@/lib/auth/roles";
import { formatDate } from "@/lib/format";
import type { Invitation } from "@/types";

function InvitationRow({ invitation }: { invitation: Invitation }) {
  const [pending, startTransition] = useTransition();
  const expired = invitation.status === "expired";

  function run(action: typeof resendInvitationAction) {
    startTransition(async () => {
      const result = await action({ id: invitation.id });
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
    });
  }

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-3 p-4">
      <div className="min-w-0 flex-1 basis-56">
        <p className="truncate text-sm font-bold">{invitation.email}</p>
        <p className="text-[13px] text-muted-foreground">
          {ROLE_LABELS[invitation.access_role]}
          {invitation.functions.length > 0
            ? ` · ${invitation.functions.map((fn) => FUNCTION_LABELS[fn]).join(", ")}`
            : ""}
        </p>
      </div>
      <Badge variant={expired ? "muted" : "outline"}>
        <Clock aria-hidden />
        {expired ? "Expirado" : `Vence em ${formatDate(invitation.expires_at)}`}
      </Badge>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" loading={pending} onClick={() => run(resendInvitationAction)}>
          <RotateCw aria-hidden />
          Reenviar
        </Button>
        <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(revokeInvitationAction)}>
          <MailX aria-hidden />
          Revogar
        </Button>
      </div>
    </li>
  );
}

export function PendingInvitations({ invitations }: { invitations: Invitation[] }) {
  if (invitations.length === 0) {
    return <p className="rounded-lg border border-dashed border-border-strong p-6 text-sm text-muted-foreground">Nenhum convite pendente.</p>;
  }
  return (
    <ul className="divide-y divide-border rounded-lg border border-border bg-card">
      {invitations.map((invitation) => (
        <InvitationRow key={invitation.id} invitation={invitation} />
      ))}
    </ul>
  );
}
