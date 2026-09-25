import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

// Paleta neutra da marca. O vermelho #E5231B é exclusivo do "é" do logo
// e NÃO existe neste tema de propósito.
const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./features/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: { DEFAULT: "var(--surface)", foreground: "var(--foreground)" },
        popover: { DEFAULT: "var(--surface-raised)", foreground: "var(--foreground)" },
        primary: { DEFAULT: "var(--primary)", foreground: "var(--primary-foreground)" },
        secondary: { DEFAULT: "var(--surface-raised)", foreground: "var(--foreground)" },
        muted: { DEFAULT: "var(--surface-raised)", foreground: "var(--muted-foreground)" },
        accent: { DEFAULT: "var(--surface-hover)", foreground: "var(--foreground)" },
        // Sem hue de erro: "destructive" é neutro. Estados vão por ícone, rótulo e peso.
        destructive: { DEFAULT: "var(--foreground)", foreground: "var(--background)" },
        surface: {
          DEFAULT: "var(--surface)",
          raised: "var(--surface-raised)",
          hover: "var(--surface-hover)",
          weekend: "var(--surface-weekend)",
        },
        border: { DEFAULT: "var(--border)", strong: "var(--border-strong)" },
        input: "var(--border-strong)",
        ring: "var(--ring)",
        subtle: "var(--subtle)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-archivo)", "var(--font-inter)", "system-ui", "sans-serif"],
      },
      borderRadius: { lg: "10px", md: "8px", sm: "6px" },
      keyframes: {
        shimmer: { "100%": { transform: "translateX(100%)" } },
      },
    },
  },
  plugins: [animate],
};

export default config;
