/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        sektor: {
          // Dark mode (default)
          bg: "var(--sektor-bg, #0F0F0F)",
          surface: "var(--sektor-surface, #1A1A1A)",
          border: "var(--sektor-border, #2A2A2A)",
          accent: "#CC0000",
          "accent-hover": "#E60000",
          "accent-light": "#FF3333",
          text: "var(--sektor-text, #F5F5F5)",
          muted: "var(--sektor-muted, #888888)",
          card: "var(--sektor-card, #1A1A1A)",
        },
        // Aliases diretos para uso sem prefixo sektor-
        brand: {
          red: "#CC0000",
          "red-dark": "#990000",
          "red-light": "#FF3333",
        },
      },
    },
  },
  plugins: [],
};
