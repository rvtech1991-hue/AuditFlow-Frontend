import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        navy: {
          950: "var(--navy-950)",
          900: "var(--navy-900)",
          800: "var(--navy-800)",
          700: "var(--navy-700)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          600: "var(--accent-600)",
          100: "var(--accent-100)",
        },
        bg: "var(--bg)",
        surface: "var(--surface)",
        border: "var(--border)",
        text: {
          DEFAULT: "var(--text)",
          muted: "var(--text-muted)",
          faint: "var(--text-faint)",
        },
        success: {
          DEFAULT: "var(--success)",
          bg: "var(--success-bg)",
        },
        warning: {
          DEFAULT: "var(--warning)",
          bg: "var(--warning-bg)",
        },
        danger: {
          DEFAULT: "var(--danger)",
          bg: "var(--danger-bg)",
        },
      },
      spacing: {
        shell: "var(--space-shell)",
        card: "var(--space-card)",
      },
      borderRadius: {
        card: "var(--radius-card)",
        input: "var(--radius-input)",
        modal: "var(--radius-modal)",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        accent: "var(--shadow-accent)",
        modal: "var(--shadow-modal)",
        menu: "var(--shadow-menu)",
      },
      fontSize: {
        "page-title": ["var(--type-page-title)", { lineHeight: "1.2", fontWeight: "800", letterSpacing: "-0.02em" }],
        "card-title": ["var(--type-card-title)", { lineHeight: "1.25", fontWeight: "700" }],
        body: ["var(--type-body)", { lineHeight: "1.45" }],
        eyebrow: ["var(--type-eyebrow)", { lineHeight: "1.2", fontWeight: "700", letterSpacing: "0.07em" }],
      },
    },
  },
  plugins: [],
} satisfies Config;
