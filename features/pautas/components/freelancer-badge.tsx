import { UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/** Sinal de que a execução da pauta está com um freelancer (não é o responsável — a equipe cobra). */
export function FreelancerBadge({ name }: { name: string }) {
  const first = name.trim().split(/\s+/)[0] ?? name;
  return (
    <Badge variant="outline" title={`Execução com o freelancer ${name}`} className="max-w-[10rem]">
      <UserRound aria-hidden />
      <span className="truncate">Freela: {first}</span>
    </Badge>
  );
}
