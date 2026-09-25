"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/auth/redirect";
import { publicEnv } from "@/lib/env";
import { REMEMBER_COOKIE } from "@/lib/supabase/cookies";
import { createClient } from "@/lib/supabase/server";
import {
  acceptInviteSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  type AcceptInviteValues,
  type ForgotPasswordValues,
  type LoginValues,
  type ResetPasswordValues,
} from "@/lib/validations/auth";
import type { ActionResult } from "@/types";

const INVALID_INPUT: ActionResult = { ok: false, error: "Revise os campos e tente novamente." };
const INVALID_SESSION: ActionResult = {
  ok: false,
  error: "Link inválido ou expirado. Peça um novo à administração.",
};

export async function loginAction(values: LoginValues, next?: string): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(values);
  if (!parsed.success) return INVALID_INPUT;

  const cookieStore = await cookies();
  cookieStore.set(REMEMBER_COOKIE, parsed.data.remember ? "1" : "0", {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    const banned = error.message.toLowerCase().includes("banned");
    return {
      ok: false,
      error: banned ? "Conta desativada. Fale com a administração." : "E-mail ou senha incorretos.",
    };
  }

  redirect(safeNextPath(next));
}

export async function forgotPasswordAction(values: ForgotPasswordValues): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(values);
  if (!parsed.success) return INVALID_INPUT;

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}/auth/confirm?next=/redefinir-senha`,
  });

  // Resposta idêntica com ou sem conta, para não revelar quem tem acesso.
  return { ok: true, message: "Se o e-mail estiver cadastrado, você receberá o link em instantes." };
}

export async function resetPasswordAction(values: ResetPasswordValues): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(values);
  if (!parsed.success) return INVALID_INPUT;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return INVALID_SESSION;

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, error: "Não foi possível redefinir a senha. Tente novamente." };

  redirect("/inicio");
}

export async function acceptInviteAction(values: AcceptInviteValues): Promise<ActionResult> {
  const parsed = acceptInviteSchema.safeParse(values);
  if (!parsed.success) return INVALID_INPUT;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return INVALID_SESSION;

  const { error: authError } = await supabase.auth.updateUser({
    password: parsed.data.password,
    data: { full_name: parsed.data.fullName },
  });
  if (authError) return { ok: false, error: "Não foi possível salvar a senha. Tente novamente." };

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.fullName })
    .eq("id", user.id);
  if (profileError) return { ok: false, error: "Não foi possível salvar seu nome. Tente novamente." };

  await supabase.rpc("accept_invitation");

  redirect("/inicio");
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
