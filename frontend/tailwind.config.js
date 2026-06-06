/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Tajawal"', "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Helvetica Neue", "Arial"]
      },
      colors: {
        brand: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#1d4ed8",
          700: "#1e40af",
          800: "#1e3a8a",
          900: "#172554"
        },
        accent: {
          50: "#fff0f6",
          100: "#ffd6e7",
          200: "#ffadd2",
          300: "#ff85c0",
          400: "#f759ab",
          500: "#e11d48",
          600: "#be123c",
          700: "#9f1239",
          800: "#881337",
          900: "#4c0519"
        },
        surface: {
          50: "#f7f8fb",
          100: "#eef1f7",
          200: "#e5e9f2"
        },
        success: { 50: "#ecfdf5", 600: "#059669" },
        warning: { 50: "#fffbeb", 600: "#d97706" },
        danger: { 50: "#fef2f2", 600: "#dc2626" }
      },
      boxShadow: {
        card: "0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)"
      },
      borderRadius: {
        xl: "14px",
        "2xl": "18px"
      }
    }
  },
  plugins: []
}
