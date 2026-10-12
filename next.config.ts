import type { NextConfig } from "next";

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname : null;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Fotos e logos do Storage são reduzidas para o tamanho de exibição (lib/images/thumbnail.ts). As URLs
  // têm ?v=<data do envio>, então a cópia reduzida pode ficar em cache por 31 dias.
  images: {
    remotePatterns: supabaseHost ? [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" }] : [],
    minimumCacheTTL: 60 * 60 * 24 * 31,
  },
  poweredByHeader: false,
  // O círculo flutuante do indicador de dev sobrepunha o botão "Recolher" da sidebar.
  devIndicators: false,
  async redirects() {
    // "Minhas Tarefas" foi renomeado para "Minhas Pautas" — mantém links e favoritos antigos vivos.
    return [{ source: "/minhas-tarefas", destination: "/minhas-pautas", permanent: true }];
  },
};

export default nextConfig;
