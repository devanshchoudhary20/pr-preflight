import { createRoot, type Root } from "react-dom/client"
import { ContentApp } from "./ContentApp"
import { parseCompareUrl, type CompareUrl } from "../lib/url"
import tokensCss from "../styles/tokens.css?inline"
import contentCss from "./content.css?inline"

export const HOST_ID = "pr-preflight-host"

function detectTheme(): "light" | "dark" {
  const mode = document.documentElement.getAttribute("data-color-mode")
  if (mode === "dark") return "dark"
  if (mode === "light") return "light"
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

export function compareUrlEquals(a: CompareUrl | null, b: CompareUrl | null): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return a.owner === b.owner && a.repo === b.repo && a.range === b.range
}

// One controller per injection, closed over its own root/state so tests can create isolated instances.
export function createNavigationController() {
  let root: Root | null = null
  let currentCompareUrl: CompareUrl | null = null

  function mountHost(): Root {
    if (root && document.getElementById(HOST_ID)) return root

    const host = document.createElement("div")
    host.id = HOST_ID
    host.setAttribute("data-theme", detectTheme())
    document.body.appendChild(host)

    const shadow = host.attachShadow({ mode: "open" })
    const style = document.createElement("style")
    style.textContent = `${tokensCss}\n${contentCss}`
    shadow.appendChild(style)

    const container = document.createElement("div")
    container.className = "prp-root"
    shadow.appendChild(container)

    root = createRoot(container)
    return root
  }

  function unmountHost(): void {
    root?.unmount()
    root = null
    document.getElementById(HOST_ID)?.remove()
  }

  // Remounts (not re-renders) via a key on owner/repo/range so a branch switch resets ContentApp state.
  function handleNavigation(): void {
    const nextUrl = parseCompareUrl(location.pathname)
    if (compareUrlEquals(currentCompareUrl, nextUrl)) return
    currentCompareUrl = nextUrl
    if (!nextUrl) {
      unmountHost()
      return
    }
    const key = `${nextUrl.owner}/${nextUrl.repo}/${nextUrl.range}`
    mountHost().render(<ContentApp key={key} compareUrl={nextUrl} />)
  }

  // Head mutations catch Turbo Drive's full-page <head>/<title> swap on a branch switch, regardless of lifecycle timing.
  function observe(): () => void {
    const headObserver = new MutationObserver(handleNavigation)
    headObserver.observe(document.head, { childList: true, subtree: true, characterData: true })
    document.addEventListener("turbo:load", handleNavigation)
    window.addEventListener("popstate", handleNavigation)
    return () => {
      headObserver.disconnect()
      document.removeEventListener("turbo:load", handleNavigation)
      window.removeEventListener("popstate", handleNavigation)
    }
  }

  return { handleNavigation, observe }
}
