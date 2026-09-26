import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Marca dentro do sistema (sidebar e menu mobile): só o símbolo — o acento vermelho do "é" —, igual
 * nos estados recolhido e expandido. O logotipo completo aparece apenas no login. O símbolo nunca é
 * recolorido, girado ou cortado; o brilho branco difuso (.brand-glow) dá presença sem competir.
 */
export function BrandLogo({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <Link href="/inicio" aria-label="Além HQ — ir para o início" className={cn("block w-fit rounded-sm", collapsed && "mx-auto")}>
      <Image src="/brand/simbolo_vermelho.png" alt="Além" width={1440} height={903} sizes="44px" className="brand-glow h-auto w-11" priority />
    </Link>
  );
}
