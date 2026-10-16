import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: "hsl(var(--navy))",
        side: "hsl(var(--side))",
        warning: "hsl(var(--warning))",
        background: "hsl(var(--background))",
        card: "hsl(var(--card))",
        foreground: "hsl(var(--foreground))",
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        border: "hsl(var(--border))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "#fff" },
        teal: { DEFAULT: "hsl(var(--teal))" },
        amber: { DEFAULT: "hsl(var(--amber))" },
        success: "hsl(var(--success))",
        danger: "hsl(var(--danger))",
        ring: "hsl(var(--primary))",
      },
      borderRadius: { xl: "14px", "2xl": "20px", "3xl": "28px" },
      boxShadow: {
        soft: "0 1px 2px rgb(18 43 73 / .04), 0 8px 24px -8px rgb(18 43 73 / .10)",
        pop: "0 12px 40px -12px rgb(18 43 73 / .28)",
      },
      fontFamily: { sans: ["Inter", "Segoe UI", "Roboto", "system-ui", "-apple-system", "sans-serif"] },
    },
  },
  plugins: [],
};
export default config;
