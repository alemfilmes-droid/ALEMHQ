"use client";

import { useEffect, useState } from "react";
import { getDealDetailAction } from "@/features/crm/actions";
import { QualificationForm } from "@/features/crm/components/qualification-form";
import type { DealQualificationDetail } from "@/features/crm/types";
import { Alert } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

interface QualificationGateDialogProps {
  dealId: string;
  /** O que o usuário queria fazer, para explicar por que precisa qualificar antes. */
  goal: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onQualified: () => void;
}

/** Aberto quando uma ação exige qualificação (agendar reunião, proposta...) — qualifica ali mesmo e segue. */
export function QualificationGateDialog({ dealId, goal, open, onOpenChange, onQualified }: QualificationGateDialogProps) {
  const [qualification, setQualification] = useState<DealQualificationDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getDealDetailAction(dealId).then((detail) => {
      if (active) {
        setQualification(detail?.qualification ?? null);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [dealId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Qualifique antes de avançar.</DialogTitle>
          <DialogDescription>
            Para {goal}, preencha orçamento, tipo de projeto, prazo desejado e se o decisor já foi contatado.
          </DialogDescription>
        </DialogHeader>
        <Alert variant="info">Assim que salvar, você continua de onde parou.</Alert>
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <QualificationForm dealId={dealId} qualification={qualification} submitLabel="Salvar e continuar" onSaved={onQualified} />
        )}
      </DialogContent>
    </Dialog>
  );
}
