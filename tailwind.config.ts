import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        /* Brand palette */
        navy: {
          DEFAULT: "#0F1F3D",
          mid: "#1A3260",
          light: "#E8EDF5",
        },
        brand: {
          text:    "#1A1A2E",
          muted:   "#6B7280",
          border:  "#E5E7EB",
          success: "#1A8C6C",
          warning: "#B87015",
          danger:  "#C0392B",
        },
        /* shadcn/ui semantic tokens */
        background: "hsl(var(--background))",
        foreground:  "hsl(var(--foreground))",
        card: {
          DEFAULT:    "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT:    "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT:    "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT:    "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT:    "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT:    "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT:    "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input:  "hsl(var(--input))",
        ring:   "hsl(var(--ring))",
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "8px",
        sm:  "6px",
        md:  "8px",
        lg:  "12px",
        xl:  "12px",
        pill: "999px",
        /* keep shadcn/ui token */
        "shadcn-lg": "var(--radius)",
      },
      fontSize: {
        "page-title":    ["24px", { fontWeight: "600", lineHeight: "1.2" }],
        "section-head":  ["18px", { fontWeight: "600", lineHeight: "1.2" }],
        "card-title":    ["15px", { fontWeight: "500", lineHeight: "1.4" }],
        body:            ["14px", { fontWeight: "400", lineHeight: "1.6" }],
        label:           ["12px", { fontWeight: "500", lineHeight: "1.4",
                                    letterSpacing: "0.04em" }],
      },
      spacing: {
        "4.5": "18px",
        "18":  "72px",
      },
      maxWidth: {
        content: "1200px",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
