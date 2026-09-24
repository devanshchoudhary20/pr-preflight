// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { useEffect } from "react"
import { act } from "react-dom/test-utils"
import { createNavigationController, compareUrlEquals, HOST_ID } from "../navigation"

// Silences react-dom's "not configured to support act" warning; act() below is exactly that configuration.
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// Isolates mount/unmount from ContentApp's data fetching but keeps one real onMessage effect, so a stale root leaks a listener.
vi.mock("../ContentApp", () => ({
  ContentApp: () => {
    useEffect(() => {
      const listener = (): void => {}
      chrome.runtime.onMessage.addListener(listener)
      return () => chrome.runtime.onMessage.removeListener(listener)
    }, [])
    return null
  }
}))

// jsdom doesn't implement matchMedia; detectTheme's prefers-color-scheme fallback needs it present.
function setPathname(pathname: string): void {
  vi.stubGlobal("location", { pathname, origin: "https://github.com" })
  vi.stubGlobal("matchMedia", () => ({ matches: false }))
}

function installChromeRuntimeStub(): (() => void)[] {
  const listeners: (() => void)[] = []
  vi.stubGlobal("chrome", {
    runtime: {
      onMessage: {
        addListener: (fn: () => void) => listeners.push(fn),
        removeListener: (fn: () => void) => {
          const index = listeners.indexOf(fn)
          if (index >= 0) listeners.splice(index, 1)
        }
      }
    }
  })
  return listeners
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
  let listeners: (() => void)[]

  beforeEach(() => {
    listeners = installChromeRuntimeStub()
  })

  afterEach(() => {
    document.body.innerHTML = ""
    vi.unstubAllGlobals()
  })

  it("mounts exactly one host on a compare URL and never a second on a no-op re-run", () => {
    setPathname("/octocat/hello-world/compare/main...feature")
    const controller = createNavigationController()
    act(() => controller.handleNavigation())
    act(() => controller.handleNavigation())
    expect(document.querySelectorAll(`#${HOST_ID}`)).toHaveLength(1)
  })

  it("reuses the single host and re-renders in place when the compare range changes", () => {
    setPathname("/octocat/hello-world/compare/main...feature")
    const controller = createNavigationController()
    act(() => controller.handleNavigation())
    const firstHost = document.getElementById(HOST_ID)

    setPathname("/octocat/hello-world/compare/main...other-branch")
    act(() => controller.handleNavigation())

    // Idempotent: a branch switch re-renders ContentApp into the same host, never spawns a second one.
    expect(document.querySelectorAll(`#${HOST_ID}`)).toHaveLength(1)
    expect(document.getElementById(HOST_ID)).toBe(firstHost)
  })

  it("unmounts the host when navigation leaves a compare URL", () => {
    setPathname("/octocat/hello-world/compare/main...feature")
    const controller = createNavigationController()
    act(() => controller.handleNavigation())
    expect(document.getElementById(HOST_ID)).not.toBeNull()

    setPathname("/octocat/hello-world/pull/12")
    act(() => controller.handleNavigation())
    expect(document.getElementById(HOST_ID)).toBeNull()
  })

  it("remounts with a fresh host and exactly one live listener when the DOM host is removed but the pathname is unchanged", () => {
    setPathname("/octocat/hello-world/compare/main...feature")
    const controller = createNavigationController()
    act(() => controller.handleNavigation())
    expect(listeners).toHaveLength(1)

    document.getElementById(HOST_ID)?.remove()
    act(() => controller.handleNavigation())

    expect(document.getElementById(HOST_ID)).not.toBeNull()
    expect(listeners).toHaveLength(1)
  })
})
