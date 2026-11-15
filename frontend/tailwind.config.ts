import type { Config } from "tailwindcss";

const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: token("bg"),
        surface: { DEFAULT: token("surface"), 2: token("surface-2") },
        border: token("border"),
        fg: { DEFAULT: token("fg"), muted: token("fg-muted") },
        accent: token("accent"),
        success: token("success"),
        warning: token("warning"),
        danger: token("danger"),
        chart: token("chart"),
      },
      borderColor: { DEFAULT: token("border") },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
