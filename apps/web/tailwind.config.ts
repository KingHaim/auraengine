import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./packages/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ui: {
          bg: "#0E1115",
          panel: "#11161C",
          card: "#171C23",
          border: "#242B35",
        },
      },
      letterSpacing: {
        tightish: ".02em",
        wideish: ".18em",
        widerbrand: ".25em",
      },
      borderStyle: {
        'dashed': 'dashed',
      },
      borderRadius: {
        xl: "0.9rem",
        "2xl": "1.2rem",
      },
    },
  },
  plugins: [],
} satisfies Config;
