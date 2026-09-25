import type { Metadata, Viewport } from "next";
import { Archivo, Inter } from "next/font/google";
import { Toaster } from "sonner";
import { publicEnv } from "@/lib/env";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  weight: "900",
  variable: "--font-archivo",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.NEXT_PUBLIC_SITE_URL),
  title: { default: "Além HQ", template: "%s · Além HQ" },
  description: "Sistema operacional interno da Além Filmes.",
  icons: { icon: "/brand/simbolo_vermelho.png" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0A0A0A",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${archivo.variable} ${inter.variable} dark`}>
      <body>
        {children}
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            classNames: {
              toast: "!bg-surface-raised !text-foreground !border !border-border-strong !font-sans !rounded-lg",
              description: "!text-muted-foreground",
            },
          }}
        />
      </body>
    </html>
  );
}
