/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Direct Carbon & Electric Violet Tokens
        carbon: {
          deep: "#0B0B10",
          DEFAULT: "#121218",
          elevated: "#181822",
        },
        slate: {
          dark: "#242430",
          panel: "#242430",
          elevated: "#30303D",
          muted: "#858596",
          subtle: "#1A1A24",
        },
        violet: {
          DEFAULT: "#A78BFA",
          hover: "#B9A4FF",
          active: "#9065F7",
          tint: "rgba(167, 139, 250, 0.12)",
          border: "rgba(167, 139, 250, 0.3)",
        },
        // Core System Aliases mapped to Carbon & Electric Violet
        brand: {
          midnight: "#0B0B10",
          electric: "#A78BFA",
          hover: "#B9A4FF",
          cantaloupe: "#F59E0B",
          violet: "#A78BFA",
        },
        surface: {
          canvas: "#121218",
          deep: "#0B0B10",
          raised: "#242430",
          panel: "#242430",
          elevated: "#30303D",
          input: "#1A1A24",
        },
        border: {
          subtle: "#2A2A38",
          strong: "#3E3E50",
          focus: "#A78BFA",
        },
        text: {
          primary: "#EAEAF2",
          secondary: "#858596",
          muted: "#6B6B7E",
          disabled: "#4B4B5A",
        },
        status: {
          success: "#10B981",
          warning: "#F59E0B",
          error: "#EF4444",
          info: "#38BDF8",
          stale: "#F59E0B",
        },
      },
      fontFamily: {
        sans: ["Noto Sans", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["Noto Sans Mono", "ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};
