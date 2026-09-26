"use server";

import { revalidatePath } from "next/cache";
import { canManageOrgLevel, can, hasCapability } from "@/lib/auth/permissions";
import { authorize, getCurrentProfile } from "@/lib/auth/session";
import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  inviteMemberSchema,
  invitationIdSchema,
  setFinanceAccessSchema,
  setMemberActiveSchema,
  transferMasterSchema,
  updateMemberSchema,
  type InviteMemberValues,
  type UpdateMemberValues,
} from "@/lib/validations/team";
import type { ActionResult, Invitation, Squad } from "@/types";

const FORBIDDEN: ActionResult = { ok: false, error: "Você não tem permissão para esta ação." };
const INVALID: ActionResult = { ok: false, error: "Revise os campos e tente novamente." };
const PERMANENT_BAN = "876000h";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/** Envia o e-mail de convite. Papel e funções também vão como metadata, além do registro em invitations. */
async function sendInviteEmail(invitation: Pick<Invitation, "id" | "email" | "access_role" | "functions" | "squads">) {
  const admin = createAdminClient();
  return admin.auth.admin.inviteUserByEmail(invitation.email, {
    data: {
      access_role: invitation.access_role,
      functions: invitation.functions,
      squads: invitation.squads,
      invitation_id: invitation.id,
    },
    redirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}/auth/confirm?next=/aceitar-convite`,
  });
}

/**
 * Convites pendentes já criam o usuário no Auth (sem senha). Antes de reenviar ou revogar,
 * remove esse usuário — apenas se ainda não aceitou. O profile cai junto (on delete cascade).
 * Retorna false se o convite já foi aceito.
 */
async function discardUnacceptedUser(supabase: ServerClient, email: string): Promise<boolean> {
  const { data: profile } = await supabase.from("profiles").select("id").eq("email", email).maybeSingle();
  if (!profile) return true;

  const admin = createAdminClient();
  const { data } = await admin.auth.admin.getUserById(profile.id);
  if (data.user?.email_confirmed_at || data.user?.last_sign_in_at) return false;

  const { error } = await admin.auth.admin.deleteUser(profile.id);
  return !error;
}

export async function inviteMemberAction(values: InviteMemberValues): Promise<ActionResult> {
  const actor = await authorize("team:invite");
  if (!actor) return FORBIDDEN;
  const parsed = inviteMemberSchema.safeParse(values);
  if (!parsed.success) return INVALID;

  const supabase = await createClient();
  await supabase.rpc("expire_stale_invitations");

  const { data: existing } = await supabase.from("profiles").select("id").eq("email", parsed.data.email).maybeSingle();
  if (existing) return { ok: false, error: "Já existe uma conta com este e-mail." };

  const { data: invitation, error } = await supabase
    .from("invitations")
    .insert({
      email: parsed.data.email,
      access_role: parsed.data.accessRole,
      functions: parsed.data.functions,
      squads: parsed.data.squads,
      invited_by: actor.id,
    })
    .select()
    .single();

  if (error) {
    const duplicate = error.code === "23505";
    return { ok: false, error: duplicate ? "Já existe um convite pendente para este e-mail." : "Não foi possível criar o convite." };
  }

  const { error: sendError } = await sendInviteEmail(invitation);
  if (sendError) {
    await supabase.from("invitations").delete().eq("id", invitation.id);
    return { ok: false, error: "Não foi possível enviar o e-mail de convite. Tente novamente." };
  }

  revalidatePath("/equipe");
  return { ok: true, message: `Convite enviado para ${parsed.data.email}.` };
}

export async function resendInvitationAction(input: { id: string }): Promise<ActionResult> {
  if (!(await authorize("team:invite"))) return FORBIDDEN;
  const parsed = invitationIdSchema.safeParse(input);
  if (!parsed.success) return INVALID;

  const supabase = await createClient();
  const { data: invitation } = await supabase.from("invitations").select("*").eq("id", parsed.data.id).maybeSingle();
  if (!invitation || (invitation.status !== "pending" && invitation.status !== "expired")) {
    return { ok: false, error: "Este convite não pode ser reenviado." };
  }

  if (!(await discardUnacceptedUser(supabase, invitation.email))) {
    return { ok: false, error: "Esta pessoa já acessou o sistema." };
  }

  const { data: renewed, error } = await supabase
    .from("invitations")
    .update({ status: "pending", expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() })
    .eq("id", invitation.id)
    .select()
    .single();
  if (error) return { ok: false, error: "Não foi possível renovar o convite." };

  const { error: sendError } = await sendInviteEmail(renewed);
  if (sendError) return { ok: false, error: "Não foi possível enviar o e-mail de convite. Tente novamente." };

  revalidatePath("/equipe");
  return { ok: true, message: `Convite reenviado para ${invitation.email}.` };
}

export async function revokeInvitationAction(input: { id: string }): Promise<ActionResult> {
  if (!(await authorize("team:invite"))) return FORBIDDEN;
  const parsed = invitationIdSchema.safeParse(input);
  if (!parsed.success) return INVALID;

  const supabase = await createClient();
  const { data: invitation } = await supabase.from("invitations").select("*").eq("id", parsed.data.id).maybeSingle();
  if (!invitation || (invitation.status !== "pending" && invitation.status !== "expired")) {
    return { ok: false, error: "Este convite não pode ser revogado." };
  }

  if (!(await discardUnacceptedUser(supabase, invitation.email))) {
    return { ok: false, error: "Esta pessoa já acessou o sistema. Desative a conta em vez de revogar." };
  }

  const { error } = await supabase.from("invitations").update({ status: "revoked" }).eq("id", invitation.id);
  if (error) return { ok: false, error: "Não foi possível revogar o convite." };

  revalidatePath("/equipe");
  return { ok: true, message: "Convite revogado." };
}

/**
 * Duas permissões independentes convergem nesta action: admin (team:edit) edita papel, funções,
 * squads e cargo; quem gerencia hierarquia (master/diretoria/head, mesmo sem ser admin) edita só
 * o nível hierárquico — e o cargo, de quebra — de quem está sob sua gestão (canManageOrgLevel,
 * que espelha can_manage_profile() no banco). Sem nenhuma das duas, nada é alterado.
 */
export async function updateMemberAction(values: UpdateMemberValues): Promise<ActionResult> {
  const actor = await getCurrentProfile();
  if (!actor) return { ok: false, error: "Sessão expirada. Entre novamente." };
  const parsed = updateMemberSchema.safeParse(values);
  if (!parsed.success) return INVALID;
  const { id: targetId } = parsed.data;

  if (targetId === actor.id) {
    if (parsed.data.orgLevel !== undefined) return { ok: false, error: "Você não pode alterar o seu próprio nível hierárquico." };
    if (parsed.data.accessRole !== actor.access_role) return { ok: false, error: "Você não pode alterar o seu próprio papel." };
  }

  const supabase = await createClient();
  const { data: target } = await supabase
    .from("profiles")
    .select("id, org_level, profile_squads(squad)")
    .eq("id", targetId)
    .maybeSingle();
  if (!target) return { ok: false, error: "Pessoa não encontrada." };

  const isAdmin = can(actor.access_role, "team:edit");
  const targetSquads = target.profile_squads.map((row) => row.squad as Squad);
  const canHierarchy = canManageOrgLevel(actor.id, actor, { id: target.id, org_level: target.org_level, squads: targetSquads });

  if (!isAdmin && !canHierarchy) return FORBIDDEN;

  const patch: { access_role?: typeof parsed.data.accessRole; functions?: typeof parsed.data.functions; job_title?: string | null; org_level?: typeof parsed.data.orgLevel } = {};
  if (isAdmin) {
    patch.access_role = parsed.data.accessRole;
    patch.functions = parsed.data.functions;
    patch.job_title = parsed.data.jobTitle === "" ? null : parsed.data.jobTitle;
  } else {
    patch.job_title = parsed.data.jobTitle === "" ? null : parsed.data.jobTitle;
  }
  if (parsed.data.orgLevel !== undefined && canHierarchy) {
    patch.org_level = parsed.data.orgLevel;
  }

  const { error } = await supabase.from("profiles").update(patch).eq("id", targetId);
  if (error) return { ok: false, error: "Não foi possível salvar as alterações." };

  if (isAdmin) {
    // Troca simples: remove todos os squads e regrava os selecionados.
    const { error: deleteSquadsError } = await supabase.from("profile_squads").delete().eq("profile_id", targetId);
    if (deleteSquadsError) return { ok: false, error: "Não foi possível salvar os squads." };
    if (parsed.data.squads.length > 0) {
      const { error: insertSquadsError } = await supabase
        .from("profile_squads")
        .insert(parsed.data.squads.map((squad) => ({ profile_id: targetId, squad })));
      if (insertSquadsError) return { ok: false, error: "Não foi possível salvar os squads." };
    }
  }

  revalidatePath("/equipe");
  return { ok: true, message: "Alterações salvas." };
}

/** Só o master atual pode chamar (a RPC também garante isso, atomicamente). */
export async function transferMasterAction(values: { newMasterId: string }): Promise<ActionResult> {
  const actor = await getCurrentProfile();
  if (!actor) return { ok: false, error: "Sessão expirada. Entre novamente." };
  if (actor.org_level !== "master") return FORBIDDEN;
  const parsed = transferMasterSchema.safeParse(values);
  if (!parsed.success) return INVALID;

  const supabase = await createClient();
  const { error } = await supabase.rpc("transfer_master", { p_new_master_id: parsed.data.newMasterId });
  if (error) {
    // 22023 (alvo inelegível) e 42501 (permissão) trazem mensagens escritas para a pessoa, em PT-BR,
    // vindas de transfer_master(). Outros erros (rede, banco) ficam com a mensagem genérica.
    const readable = error.code === "22023" || error.code === "42501";
    return { ok: false, error: readable ? error.message : "Não foi possível transferir o master. Tente de novo." };
  }

  // O layout inteiro depende do nível (navegação, permissões): recarrega tudo.
  revalidatePath("/", "layout");
  return { ok: true, message: "Master transferido. Você agora é Diretoria." };
}

export async function setMemberActiveAction(values: { id: string; active: boolean }): Promise<ActionResult> {
  const actor = await authorize("team:deactivate");
  if (!actor) return FORBIDDEN;
  const parsed = setMemberActiveSchema.safeParse(values);
  if (!parsed.success) return INVALID;

  if (parsed.data.id === actor.id) return { ok: false, error: "Você não pode desativar a própria conta." };

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ is_active: parsed.data.active }).eq("id", parsed.data.id);
  if (error) return { ok: false, error: "Não foi possível atualizar o status." };

  // Bloqueia (ou libera) também o login e a renovação de sessão no Auth.
  const admin = createAdminClient();
  const { error: banError } = await admin.auth.admin.updateUserById(parsed.data.id, {
    ban_duration: parsed.data.active ? "none" : PERMANENT_BAN,
  });
  if (banError) return { ok: false, error: "Status atualizado, mas o bloqueio de login falhou. Tente novamente." };

  revalidatePath("/equipe");
  return { ok: true, message: parsed.data.active ? "Conta reativada." : "Conta desativada." };
}

/** Somente quem já tem acesso ao financeiro concede ou revoga (também imposto por trigger no banco). */
export async function setFinanceAccessAction(values: { id: string; granted: boolean }): Promise<ActionResult> {
  const actor = await authorize("team:edit");
  if (!actor || !hasCapability(actor, "finance")) return FORBIDDEN;
  const parsed = setFinanceAccessSchema.safeParse(values);
  if (!parsed.success) return INVALID;

  if (parsed.data.id === actor.id) {
    return { ok: false, error: "Você não pode alterar o seu próprio acesso ao financeiro." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ has_finance_access: parsed.data.granted })
    .eq("id", parsed.data.id);
  if (error) return { ok: false, error: "Não foi possível alterar o acesso ao financeiro." };

  revalidatePath("/equipe");
  return { ok: true, message: parsed.data.granted ? "Acesso ao financeiro concedido." : "Acesso ao financeiro revogado." };
}
