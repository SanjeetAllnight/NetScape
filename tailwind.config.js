/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          midnight: "#02070A",
          electric: "#0297DE",
          cantaloupe: "#FC734D",
        },
        surface: {
          canvas: "#02070A",
          raised: "#071117",
          panel: "#0A171E",
          elevated: "#10212A",
          input: "#08131A",
        },
        border: {
          subtle: "#172A34",
          strong: "#29414D",
        },
        text: {
          primary: "#E7F0F4",
          secondary: "#9AAEB8",
          muted: "#6F858F",
          disabled: "#4B606A",
        },
        status: {
          success: "#35A879",
          warning: "#E4AD4C",
          error: "#E05A5A",
          info: "#0297DE",
          stale: "#FC734D",
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
