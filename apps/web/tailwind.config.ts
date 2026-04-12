import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#f6fafe",
        foreground: "#171c1f",
        primary: "#006c50",
        "primary-container": "#36c497",
        "primary-fixed": "#75fac9",
        "primary-fixed-dim": "#56ddae",
        secondary: "#545f73",
        "secondary-container": "#d5e0f8",
        "on-secondary-container": "#586377",
        tertiary: "#7f5600",
        "tertiary-fixed": "#ffdeae",
        "tertiary-fixed-dim": "#ffba3f",
        "tertiary-container": "#e8a100",
        error: "#ba1a1a",
        "on-error": "#ffffff",
        "error-container": "#ffdad6",
        "on-error-container": "#93000a",
        surface: "#f6fafe",
        "surface-dim": "#d6dade",
        "surface-bright": "#f6fafe",
        "surface-variant": "#dfe3e7",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#f0f4f8",
        "surface-container": "#eaeef2",
        "surface-container-high": "#e4e9ed",
        "surface-container-highest": "#dfe3e7",
        outline: "#6c7a73",
        "outline-variant": "#bbcac1",
        "on-background": "#171c1f",
        "on-surface": "#171c1f",
        "on-surface-variant": "#3d4a43",
        "inverse-surface": "#2c3134",
        "inverse-on-surface": "#edf1f5",
      },
      fontFamily: {
        headline: ["var(--font-manrope)"],
        body: ["var(--font-inter)"],
      },
      borderRadius: {
        DEFAULT: "0.5rem",
        xl: "1.5rem",
        xxl: "1.5rem",
      },
    },
  },
  plugins: [],
};
export default config;
