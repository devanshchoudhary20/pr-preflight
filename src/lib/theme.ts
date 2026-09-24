// GitHub's data-color-mode wins when present (content script); prefers-color-scheme is the fallback for popup/options pages.
export function detectTheme(): "light" | "dark" {
  const mode = document.documentElement.getAttribute("data-color-mode")
  if (mode === "dark") return "dark"
  if (mode === "light") return "light"
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}
