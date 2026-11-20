export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#15100A",
        surface: "#211910",
        raised: "#2C2114",
        hairline: "#3A2D1D",
        ink: "#F5EEE3",
        soft: "#B2A28E",
        faint: "#7C6E5C",
        accent: {
          DEFAULT: "#FF8A00",
          dark: "#D97208",
          soft: "#3A2712",
        },
        ok: {
          DEFAULT: "#4ADE80",
          soft: "#1A3324",
        },
        danger: {
          DEFAULT: "#F87171",
          soft: "#381E1E",
        },
        warn: "#FBBF24",
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
