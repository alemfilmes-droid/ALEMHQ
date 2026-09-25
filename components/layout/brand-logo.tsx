import Image from "next/image";
import Link from "next/link";

/**
 * Logo da marca, sem recolorir, girar ou cortar — o vermelho continua só no "é". Recolhida, a
 * sidebar mostra o símbolo original completo. Espaço generoso acima do logo (o acento não encosta
 * em nada) e um brilho branco difuso de baixa opacidade (.brand-glow), que dá presença sem
 * embaçar as letras.
 */
export function BrandLogo({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <Link href="/inicio" aria-label="Além HQ — ir para o início" className="block rounded-sm">
      {collapsed ? (
        <Image src="/brand/simbolo_vermelho.png" alt="Além" width={1440} height={903} sizes="44px" className="brand-glow mx-auto h-auto w-11" priority />
      ) : (
        <Image src="/brand/alem_texto-branco.png" alt="Além" width={4100} height={1432} sizes="152px" className="brand-glow h-auto w-[152px]" priority />
      )}
    </Link>
  );
}
