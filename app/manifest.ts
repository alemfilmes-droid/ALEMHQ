import type { MetadataRoute } from "next";

/** App instalável (tela de início do iPhone/Android): necessário para o push no iOS. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Além HQ",
    short_name: "Além HQ",
    description: "Sistema operacional interno da Além Filmes.",
    lang: "pt-BR",
    start_url: "/inicio",
    scope: "/",
    display: "standalone",
    background_color: "#0A0A0A",
    theme_color: "#0A0A0A",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
