export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  // Classes do design system ficam disponíveis mesmo antes de todas as telas
  // migrarem (o Tailwind só emite componentes custom que aparecem no content).
  safelist: ["card", "field", "btn-primary", "chip"],

  theme: {
    extend: {
      colors: {
        canvas: "#F6F6F4",
        hairline: "#E8E9E6",
        ink: "#1A1C1A",
        soft: "#6F7671",
        faint: "#A3A9A5",
        accent: {
          DEFAULT: "#0F766E",
          soft: "#E7F2F0",
        },
        ok: "#3E7A46",
        danger: "#B3402F",
      },
      fontFamily: {
        sans: [
          "Inter",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
