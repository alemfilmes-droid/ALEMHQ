import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export function InvalidLink() {
  return (
    <div className="space-y-6">
      <div className="flex gap-3 rounded-md border-2 border-foreground bg-surface-raised p-4 text-sm">
        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p className="font-semibold">Link inválido ou expirado. Peça um novo à administração.</p>
      </div>
      <Link href="/login" className={buttonVariants({ variant: "secondary", size: "lg", className: "w-full" })}>
        Ir para o login
      </Link>
    </div>
  );
}
