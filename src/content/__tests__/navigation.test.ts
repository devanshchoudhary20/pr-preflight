// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from "vitest"
import { createNavigationController, compareUrlEquals, HOST_ID } from "../navigation"

// Isolates the mount/unmount decision logic under test from ContentApp's own
// data fetching (chrome.storage, fetch), which belongs to ContentApp's tests.
vi.mock("../ContentApp", () => ({ ContentApp: () => null }))

// jsdom doesn't implement matchMedia; detectTheme's prefers-color-scheme fallback needs it present.
function setPathname(pathname: string): void {
  vi.stubGlobal("location", { pathname, origin: "https://github.com" })
  vi.stubGlobal("matchMedia", () => ({ matches: false }))
}

describe("compareUrlEquals", () => {
  it("treats two urls with the same owner/repo/range as equal", () => {
    const a = { owner: "octocat", repo: "hello-world", range: "main...feature" }
    const b = { owner: "octocat", repo: "hello-world", range: "main...feature" }
    expect(compareUrlEquals(a, b)).toBe(true)
    expect(compareUrlEquals(a, null)).toBe(false)
    expect(compareUrlEquals(null, null)).toBe(true)
  })
})

describe("navigation controller", () => {
  afterEach(() => {
    document.body.innerHTML = ""
    vi.unstubAllGlobals()
  })

  it("mounts exactly one host on a compare URL and never a second on a no-op re-run", () => {
    setPathname("/octocat/hello-world/compare/main...feature")
    const controller = createNavigationController()
    controller.handleNavigation()
    controller.handleNavigation()
    expect(document.querySelectorAll(`#${HOST_ID}`)).toHaveLength(1)
  })

  it("reuses the single host and re-renders in place when the compare range changes", () => {
    setPathname("/octocat/hello-world/compare/main...feature")
    const controller = createNavigationController()
    controller.handleNavigation()
    const firstHost = document.getElementById(HOST_ID)

    setPathname("/octocat/hello-world/compare/main...other-branch")
    controller.handleNavigation()

    // Idempotent: switching the branch dropdown never spawns a second host,
    // it re-renders ContentApp (keyed on owner/repo/range) into the same one.
    expect(document.querySelectorAll(`#${HOST_ID}`)).toHaveLength(1)
    expect(document.getElementById(HOST_ID)).toBe(firstHost)
  })

  it("unmounts the host when navigation leaves a compare URL", () => {
    setPathname("/octocat/hello-world/compare/main...feature")
    const controller = createNavigationController()
    controller.handleNavigation()
    expect(document.getElementById(HOST_ID)).not.toBeNull()

    setPathname("/octocat/hello-world/pull/12")
    controller.handleNavigation()
    expect(document.getElementById(HOST_ID)).toBeNull()
  })
})
