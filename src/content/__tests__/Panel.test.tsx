// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { createRoot, type Root } from "react-dom/client"
import { act } from "react-dom/test-utils"
import { Panel } from "../Panel"
import { installChromeStorageStub } from "../../lib/__tests__/chromeStorageStub"
import type { Finding } from "../../lib/checks/types"

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const findings: Finding[] = [{ id: "secrets", level: "pass", title: "No secret patterns found", items: [] }]

async function renderPanel(container: Element): Promise<Root> {
  const root = createRoot(container)
  // loadTicks resolves a microtask after mount; flush it inside act so its setCheckedIds doesn't leak into the click assertion below.
  await act(async () => {
    root.render(
      <Panel
        compareUrl={{ owner: "octocat", repo: "hello-world", range: "main...feature" }}
        loadState="ready"
        stats={{ files: 1, additions: 1, deletions: 0 }}
        findings={findings}
        errorMessage={null}
        onRetry={() => {}}
        onCollapse={() => {}}
      />
    )
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
  return root
}

describe("Panel copy fallback", () => {
  beforeEach(() => {
    installChromeStorageStub()
  })

  afterEach(() => {
    document.body.innerHTML = ""
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("falls back to execCommand and shows Copied when clipboard.writeText rejects", async () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn(() => Promise.reject(new Error("not focused"))) } })
    const execCommand = vi.fn(() => true)
    document.execCommand = execCommand as unknown as typeof document.execCommand

    const host = document.createElement("div")
    document.body.appendChild(host)
    const root = await renderPanel(host)

    const button = host.querySelector<HTMLButtonElement>(".prp-copy-markdown")
    await act(async () => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(execCommand).toHaveBeenCalledWith("copy")
    expect(button?.textContent).toBe("Copied")
    act(() => root.unmount())
  })

  it("shows Copy failed when both clipboard.writeText and execCommand fail", async () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn(() => Promise.reject(new Error("not focused"))) } })
    document.execCommand = vi.fn(() => false) as unknown as typeof document.execCommand

    const host = document.createElement("div")
    document.body.appendChild(host)
    const root = await renderPanel(host)

    const button = host.querySelector<HTMLButtonElement>(".prp-copy-markdown")
    await act(async () => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(button?.textContent).toBe("Copy failed")
    act(() => root.unmount())
  })
})
