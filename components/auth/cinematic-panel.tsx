/**
 * Painel visual do login: feixes de luz lentos e reflexos de lente em cinzas profundos com acentos
 * vermelhos contidos, grão de filme e vinheta — a sensação de um set às escuras. Só CSS/SVG (nenhum
 * vídeo, nenhuma biblioteca): as camadas animam apenas transform/opacity (GPU), ficam atrás de
 * `pointer-events: none` e param por completo com prefers-reduced-motion. Estilos em app/globals.css
 * (.cine-*), cores só por token.
 */
export function CinematicPanel() {
  return (
    <div aria-hidden className="cine-panel">
      <div className="cine-beam cine-beam-a" />
      <div className="cine-beam cine-beam-b" />
      <div className="cine-beam cine-beam-c" />
      <div className="cine-flare" />
      <div className="cine-flare-streak" />
      <svg className="cine-grain" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
        <filter id="cine-grain-filter">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#cine-grain-filter)" />
      </svg>
      <div className="cine-vignette" />
      <div className="cine-letterbox cine-letterbox-top" />
      <div className="cine-letterbox cine-letterbox-bottom" />
    </div>
  );
}
