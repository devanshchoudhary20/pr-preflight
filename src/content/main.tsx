import { createRoot } from "react-dom/client"
import { ContentApp } from "./ContentApp"
import tokensCss from "../styles/tokens.css?inline"
import contentCss from "./content.css?inline"

function detectTheme(): "light" | "dark" {
  const mode = document.documentElement.getAttribute("data-color-mode")
  if (mode === "dark") return "dark"
  if (mode === "light") return "light"
  const dark = document.documentElement.getAttribute("data-dark-theme")
  if (mode === "auto" && dark) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

function parseRange(): string | null {
  const match = location.pathname.match(/^\/([^/]+)\/([^/]+)\/compare\/(.+?)\/?$/)
  return match ? match[3] : null
}

const host = document.createElement("div")
host.id = "pr-preflight-host"
document.body.appendChild(host)

host.setAttribute("data-theme", detectTheme())
const shadow = host.attachShadow({ mode: "open" })

const style = document.createElement("style")
style.textContent = `${tokensCss}\n${contentCss}`
shadow.appendChild(style)

const mount = document.createElement("div")
mount.className = "prp-root"
shadow.appendChild(mount)

createRoot(mount).render(<ContentApp range={parseRange()} />)
