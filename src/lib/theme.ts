// GitHub's own light/dark/auto attribute wins when present (content script, on github.com); prefers-color-scheme
// is the fallback for the popup/options pages, which aren't on github.com and never see data-color-mode.
export function detectTheme(): "light" | "dark" {
  const mode = document.documentElement.getAttribute("data-color-mode")
  if (mode === "dark") return "dark"
  if (mode === "light") return "light"
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}
