import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // O círculo flutuante do indicador de dev sobrepunha o botão "Recolher" da sidebar.
  devIndicators: false,
  async redirects() {
    // "Minhas Tarefas" foi renomeado para "Minhas Pautas" — mantém links e favoritos antigos vivos.
    return [{ source: "/minhas-tarefas", destination: "/minhas-pautas", permanent: true }];
  },
};

export default nextConfig;
