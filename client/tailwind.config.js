// Design tokens (see src/index.css). The type scale and weights replace
// Tailwind's defaults so only approved values can be used.

module.exports = {
  content: ["./src/**/*.{js,jsx}"],
  theme: {
    fontSize: {
      xs: ["12px", { lineHeight: "16px" }],
      sm: ["14px", { lineHeight: "20px" }],
      base: ["16px", { lineHeight: "24px" }],
      lg: ["20px", { lineHeight: "28px" }],
      xl: ["24px", { lineHeight: "32px" }],
      "2xl": ["30px", { lineHeight: "38px" }],
    },
    fontWeight: {
      normal: "400",
      medium: "500",
      semibold: "600",
    },
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
      },
      colors: {
        page: "#F7F8FA",
        surface: "#FFFFFF",
        line: { DEFAULT: "#E4E7EC", strong: "#D0D5DD" },
        hover: "#F2F4F7",
        track: "#EAECF0",
        ink: { DEFAULT: "#101828", secondary: "#344054", muted: "#667085" },
        brand: { DEFAULT: "#0F766E", hover: "#115E59", tint: "#F0FDFA" },
        success: { DEFAULT: "#067647", tint: "#ECFDF3" },
        warning: { DEFAULT: "#B54708", tint: "#FFFAEB" },
        danger: { DEFAULT: "#B42318", tint: "#FEF3F2" },
      },
      borderRadius: { card: "10px", control: "6px" },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,40,.05)",
        overlay: "0 8px 24px rgba(16,24,40,.12)",
      },
      transitionDuration: { DEFAULT: "150ms" },
    },
  },
  plugins: [],
};
