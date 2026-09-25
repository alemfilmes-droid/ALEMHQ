import "server-only";
import { z } from "zod";
import { publicEnv } from "@/lib/env";

const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

const parsed = serverEnvSchema.safeParse({
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
});

if (!parsed.success) {
  throw new Error("Variável de ambiente ausente: SUPABASE_SERVICE_ROLE_KEY");
}

export const serverEnv = { ...publicEnv, ...parsed.data };
