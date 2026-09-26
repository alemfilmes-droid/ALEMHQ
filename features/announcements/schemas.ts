import { z } from "zod";
import { ORG_LEVELS } from "@/lib/auth/org";
import { SQUADS } from "@/lib/auth/squads";

const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const time = /^\d{2}:\d{2}$/;

/**
 * Formulário de aviso. Datas e horas em America/Fortaleza. Público vazio = todos. Sem data de
 * encerramento = fica no ar até ser arquivado.
 */
export const announcementSchema = z
  .object({
    title: z.string().trim().min(2, "Informe o título.").max(160, "Use até 160 caracteres."),
    body: z.string().trim().min(1, "Escreva o aviso.").max(20000, "Texto longo demais."),
    publishDate: z.string().regex(isoDate, "Informe a data de publicação."),
    publishTime: z.string().regex(time, "Informe a hora."),
    expiresDate: z.string().regex(isoDate, "Informe uma data válida.").or(z.literal("")),
    expiresTime: z.string().regex(time, "Informe a hora.").or(z.literal("")),
    audienceSquads: z.array(z.enum(SQUADS)).max(SQUADS.length),
    audienceLevels: z.array(z.enum(ORG_LEVELS)).max(ORG_LEVELS.length),
    isPinned: z.boolean(),
  })
  .refine(
    (values) =>
      !values.expiresDate ||
      `${values.expiresDate}T${values.expiresTime || "23:59"}` > `${values.publishDate}T${values.publishTime}`,
    { message: "O encerramento precisa ser depois da publicação.", path: ["expiresDate"] },
  );

export type AnnouncementValues = z.infer<typeof announcementSchema>;
