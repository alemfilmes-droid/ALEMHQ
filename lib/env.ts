import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.string().url(),
});

// Cada variável é lida por nome literal para o Next.js poder embuti-la no bundle.
const parsed = publicEnvSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
});

if (!parsed.success) {
  const fields = Object.keys(parsed.error.flatten().fieldErrors).join(", ");
  throw new Error(`Variáveis de ambiente públicas inválidas ou ausentes: ${fields}`);
}

export const publicEnv = {
  ...parsed.data,
  NEXT_PUBLIC_SITE_URL: parsed.data.NEXT_PUBLIC_SITE_URL.replace(/\/$/, ""),
};
