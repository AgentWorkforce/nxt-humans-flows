// Design-library tokens. Replace these with the values from the Figma library's
// color and text styles; components read nothing else.
export const theme = {
  width: 600,
  font: "Helvetica, Arial, sans-serif",
  radius: 6,
  color: {
    canvas: "#f4f4f5",
    surface: "#ffffff",
    muted: "#fafafa",
    border: "#e4e4e7",
    text: "#18181b",
    textMuted: "#71717a",
    brand: "#4f46e5",
    onBrand: "#ffffff",
  },
  type: {
    h1: { fontSize: 28, lineHeight: "34px", fontWeight: 700, color: "#18181b" },
    h2: { fontSize: 22, lineHeight: "28px", fontWeight: 700, color: "#18181b" },
    h3: { fontSize: 18, lineHeight: "24px", fontWeight: 600, color: "#18181b" },
    body: { fontSize: 16, lineHeight: "24px", color: "#18181b" },
    small: { fontSize: 12, lineHeight: "18px", color: "#71717a" },
  },
} as const;
