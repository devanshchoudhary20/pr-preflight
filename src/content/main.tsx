import { createRoot } from "react-dom/client"
import { ContentApp } from "./ContentApp"
import { parseCompareUrl } from "../lib/url"
import tokensCss from "../styles/tokens.css?inline"
import contentCss from "./content.css?inline"

const HOST_ID = "pr-preflight-host"

function detectTheme(): "light" | "dark" {
  const mode = document.documentElement.getAttribute("data-color-mode")
  if (mode === "dark") return "dark"
  if (mode === "light") return "light"
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

function mount(): void {
  if (document.getElementById(HOST_ID)) return

  const host = document.createElement("div")
  host.id = HOST_ID
  host.setAttribute("data-theme", detectTheme())
  document.body.appendChild(host)

  const shadow = host.attachShadow({ mode: "open" })

  const style = document.createElement("style")
  style.textContent = `${tokensCss}\n${contentCss}`
  shadow.appendChild(style)

  const root = document.createElement("div")
  root.className = "prp-root"
  shadow.appendChild(root)

  createRoot(root).render(<ContentApp compareUrl={parseCompareUrl(location.pathname)} />)
}

mount()
