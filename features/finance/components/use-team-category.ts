"use client";

import { useEffect, useRef } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { PayableValues } from "@/features/finance/schemas";
import { TEAM_CATEGORY, teamCategoryRule, type TeamPaymentType } from "@/lib/finance/team-category";

/**
 * Aplica a regra de "Equipe e colaboradores" enquanto a pessoa preenche (o banco aplica a mesma ao salvar):
 * trava a categoria quando o favorecido é da equipe ou é pró-labore; reembolso fica na categoria da despesa (nunca
 * Equipe); escolhe o tipo; e, quando a
 * trava sai (favorecido deixou de ser da equipe), limpa a categoria automática para a pessoa escolher outra.
 */
export function useTeamCategory(form: UseFormReturn<PayableValues>) {
  const { watch, setValue } = form;
  const category = watch("category");
  const payeeProfileId = watch("payeeProfileId");
  const isProLabore = watch("isProLabore");
  const isReimbursement = watch("isReimbursement");
  const teamPaymentType = watch("teamPaymentType");
  const commissionGoalId = watch("commissionGoalId");

  const rule = teamCategoryRule({
    category,
    payeeIsMember: payeeProfileId !== "",
    isProLabore,
    isReimbursement,
    teamType: teamPaymentType === "" ? null : teamPaymentType,
    hasCommissionGoal: commissionGoalId !== "",
  });
  // Categoria que a trava impôs (para saber o que limpar quando ela sair).
  const imposed = useRef<PayableValues["category"] | null>(rule.lock ? rule.category : null);

  useEffect(() => {
    if (rule.lock) {
      if (category !== rule.category) setValue("category", rule.category, { shouldValidate: true });
      imposed.current = rule.category;
    } else if (isReimbursement && Boolean(category) && category !== rule.category) {
      // Reembolso nunca fica em Equipe e colaboradores.
      setValue("category", rule.category, { shouldValidate: true });
    } else if (imposed.current !== null) {
      // Saiu a trava: a categoria que era automática não vale mais; a pessoa escolhe outra.
      if (category === imposed.current) setValue("category", "" as PayableValues["category"]);
      imposed.current = null;
    }
    const nextType = rule.teamType ?? "";
    if (teamPaymentType !== nextType) setValue("teamPaymentType", nextType);
  }, [rule.lock, rule.category, rule.teamType, category, teamPaymentType, isReimbursement, setValue]);

  const typeOptions: TeamPaymentType[] = rule.teamType === "pro_labore" ? ["pro_labore"] : ["pagamento_colaborador", "comissao"];
  return {
    lock: rule.lock,
    teamType: rule.category === TEAM_CATEGORY ? rule.teamType : null,
    typeOptions,
    isProLabore,
    isReimbursement,
  };
}
