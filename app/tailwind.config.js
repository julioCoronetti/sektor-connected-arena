/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        sektor: {
          bg: "#0A0A0F",
          surface: "#13131A",
          border: "#1E1E2E",
          accent: "#6C63FF",
          "accent-light": "#8B85FF",
          text: "#F0F0F5",
          muted: "#6B6B80",
        },
      },
    },
  },
  plugins: [],
};
