/**
 * Promove um e-mail a administrador (bootstrap da primeira conta).
 *
 * Uso:  npm run create-first-admin -- dono@alemfilmes.com
 *
 * - Se a pessoa já tem conta (criada em Authentication → Users ou por convite aceito),
 *   o profile vira `admin` e ativo.
 * - Se não existe conta, envia um convite de administração por e-mail.
 *
 * Lê NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e NEXT_PUBLIC_SITE_URL de .env.local.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "../types/database";

config({ path: ".env.local" });
config();

const env = z
  .object({
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    NEXT_PUBLIC_SITE_URL: z.string().url(),
  })
  .safeParse(process.env);

const email = z.string().email().safeParse(process.argv[2]?.trim().toLowerCase());

if (!env.success || !email.success) {
  console.error("Uso: npm run create-first-admin -- <email>");
  if (!env.success) console.error("Variáveis ausentes em .env.local:", Object.keys(env.error.flatten().fieldErrors).join(", "));
  if (!email.success) console.error("Informe um e-mail válido.");
  process.exit(1);
}

const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SITE_URL } = env.data;
const address = email.data;

const supabase = createClient<Database>(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data: profile, error } = await supabase.from("profiles").select("id").eq("email", address).maybeSingle();
  if (error) throw error;

  if (profile) {
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ access_role: "admin", is_active: true, has_finance_access: true })
      .eq("id", profile.id);
    if (updateError) throw updateError;
    console.log(`${address} agora é administrador.`);
    return;
  }

  // Conta criada no Auth antes das migrações (o trigger não rodou): cria o profile como admin.
  const { data: users, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listError) throw listError;
  const authUser = users.users.find((user) => user.email?.toLowerCase() === address);
  if (authUser) {
    const { error: insertError } = await supabase.from("profiles").insert({
      id: authUser.id,
      email: address,
      full_name: typeof authUser.user_metadata?.full_name === "string" ? authUser.user_metadata.full_name : "",
      access_role: "admin",
      has_finance_access: true,
    });
    if (insertError) throw insertError;
    console.log(`${address} já tinha conta no Auth; profile criado e promovido a administrador.`);
    return;
  }

  const { data: invitation, error: inviteError } = await supabase
    .from("invitations")
    .insert({ email: address, access_role: "admin", functions: [] })
    .select()
    .single();
  if (inviteError) throw inviteError;

  const { error: sendError } = await supabase.auth.admin.inviteUserByEmail(address, {
    data: { access_role: "admin", functions: [], invitation_id: invitation.id },
    redirectTo: `${NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/auth/confirm?next=/aceitar-convite`,
  });
  if (sendError) {
    await supabase.from("invitations").delete().eq("id", invitation.id);
    throw sendError;
  }
  console.log(`Convite de administração enviado para ${address}.`);
  console.log("Depois que a pessoa aceitar o convite, rode este comando de novo para conceder o acesso ao financeiro.");
}

main().catch((err: unknown) => {
  console.error("Falha:", err instanceof Error ? err.message : err);
  process.exit(1);
});
