// @vitest-environment jsdom
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { createRoot, type Root } from "react-dom/client"
import { act } from "react-dom/test-utils"
import { Panel } from "../Panel"
import { installChromeStorageStub } from "../../lib/__tests__/chromeStorageStub"
import type { Finding } from "../../lib/checks/types"

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const findings: Finding[] = [{ id: "secrets", level: "pass", title: "No secret patterns found", items: [] }]

const SIX_FINDINGS: Finding[] = ["diff-size", "todo-markers", "secrets", "tests-missing", "debug-leftovers", "lockfile-drift"].map(
  (id) => ({ id, level: "warn", title: `Check ${id}`, items: [{ path: `${id}.ts`, line: 1, snippet: "const x = 1" }] })
)

interface RenderPanelOptions {
  findings?: Finding[]
  onCollapse?: () => void
}

async function renderPanel(container: Element, options: RenderPanelOptions = {}): Promise<Root> {
  const root = createRoot(container)
  // loadTicks resolves a microtask after mount; flush it inside act so its setCheckedIds doesn't leak into the click assertion below.
  await act(async () => {
    root.render(
      <Panel
        compareUrl={{ owner: "octocat", repo: "hello-world", range: "main...feature" }}
        loadState="ready"
        stats={{ files: 1, additions: 1, deletions: 0 }}
        findings={options.findings ?? findings}
        errorMessage={null}
        onRetry={() => {}}
        onCollapse={options.onCollapse ?? (() => {})}
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

describe("Panel viewport layout", () => {
  const contentCss = readFileSync(join(process.cwd(), "src/content/content.css"), "utf-8")

  beforeEach(() => {
    installChromeStorageStub()
  })

  afterEach(() => {
    document.body.innerHTML = ""
  })

  it("keeps .prp-panel-body as the only scrolling region, sized to the viewport", () => {
    // Pixel layout doesn't compute in jsdom, so assert the class and the actual rule text rather than measured sizes.
    expect(contentCss).toMatch(/\.prp-panel\s*{[^}]*max-height:\s*calc\(100vh - 32px\)/)
    expect(contentCss).toMatch(/\.prp-panel-body\s*{[^}]*overflow-y:\s*auto/)
    expect(contentCss).toMatch(/\.prp-panel-header\s*{[^}]*flex-shrink:\s*0/)
    expect(contentCss).toMatch(/\.prp-panel-footer\s*{[^}]*flex-shrink:\s*0/)
  })

  it("keeps header and footer pinned outside the scrollable body with 6 expanded rows", async () => {
    const host = document.createElement("div")
    document.body.appendChild(host)
    const root = await renderPanel(host, { findings: SIX_FINDINGS })

    const toggles = host.querySelectorAll<HTMLButtonElement>(".prp-row-toggle")
    expect(toggles).toHaveLength(6)
    await act(async () => {
      toggles.forEach((toggle) => toggle.dispatchEvent(new MouseEvent("click", { bubbles: true })))
    })

    const panel = host.querySelector(".prp-panel")
    const body = host.querySelector(".prp-panel-body")
    expect(body).not.toBeNull()
    // Header/footer sit as direct siblings of the body, never inside it, so only the body's overflow ever scrolls.
    expect(panel?.children[0].className).toBe("prp-panel-header")
    expect(panel?.children[1].className).toBe("prp-panel-body")
    expect(panel?.children[2].className).toBe("prp-panel-footer")
    expect(body?.querySelectorAll(".prp-row-items")).toHaveLength(6)

    act(() => root.unmount())
  })

  it("collapses on Escape when focus is inside the panel", async () => {
    const onCollapse = vi.fn()
    const host = document.createElement("div")
    document.body.appendChild(host)
    const root = await renderPanel(host, { onCollapse })

    const insideNode = host.querySelector(".prp-panel-repo")
    await act(async () => {
      insideNode?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
    })

    expect(onCollapse).toHaveBeenCalledTimes(1)
    act(() => root.unmount())
  })

  it("does not collapse on Escape dispatched outside the panel", async () => {
    const onCollapse = vi.fn()
    const host = document.createElement("div")
    document.body.appendChild(host)
    const root = await renderPanel(host, { onCollapse })

    // No document-level listener exists for this; only a page-focused Escape (unrelated subtree) reaches document here.
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))

    expect(onCollapse).not.toHaveBeenCalled()
    act(() => root.unmount())
  })
})

describe("Panel insert into description", () => {
  beforeEach(() => {
    installChromeStorageStub()
  })

  afterEach(() => {
    document.body.innerHTML = ""
    vi.useRealTimers()
  })

  it("renders the button when #pull_request_body is a textarea", async () => {
    const textarea = document.createElement("textarea")
    textarea.id = "pull_request_body"
    document.body.appendChild(textarea)
    const host = document.createElement("div")
    document.body.appendChild(host)
    const root = await renderPanel(host)

    expect(host.querySelector(".prp-insert-description")).not.toBeNull()
    act(() => root.unmount())
  })

  it("hides the button when #pull_request_body exists but is not a textarea", async () => {
    const notATextarea = document.createElement("div")
    notATextarea.id = "pull_request_body"
    document.body.appendChild(notATextarea)
    const host = document.createElement("div")
    document.body.appendChild(host)
    const root = await renderPanel(host)

    expect(host.querySelector(".prp-insert-description")).toBeNull()
    act(() => root.unmount())
  })

  it("appends the markdown block, fires input/change, focuses the field, and shows Inserted then reverts", async () => {
    const textarea = document.createElement("textarea")
    textarea.id = "pull_request_body"
    textarea.value = "existing text"
    document.body.appendChild(textarea)
    const host = document.createElement("div")
    document.body.appendChild(host)
    const root = await renderPanel(host, { findings: SIX_FINDINGS })
    // Fake timers only after mount: renderPanel's own microtask flush relies on a real setTimeout(0).
    vi.useFakeTimers({ toFake: ["setTimeout"] })

    const inputSpy = vi.fn()
    const changeSpy = vi.fn()
    textarea.addEventListener("input", inputSpy)
    textarea.addEventListener("change", changeSpy)

    const button = host.querySelector<HTMLButtonElement>(".prp-insert-description")
    await act(async () => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    })

    expect(textarea.value.startsWith("existing text\n\n- [ ] Check diff-size")).toBe(true)
    expect(inputSpy).toHaveBeenCalledTimes(1)
    expect(changeSpy).toHaveBeenCalledTimes(1)
    expect(document.activeElement).toBe(textarea)
    expect(button?.textContent).toBe("Inserted")

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    expect(button?.textContent).toBe("Insert into description")

    act(() => root.unmount())
  })

  it("shows Field not found when the textarea disappears before click, then reverts", async () => {
    const textarea = document.createElement("textarea")
    textarea.id = "pull_request_body"
    document.body.appendChild(textarea)
    const host = document.createElement("div")
    document.body.appendChild(host)
    const root = await renderPanel(host)
    vi.useFakeTimers({ toFake: ["setTimeout"] })

    textarea.remove()
    const button = host.querySelector<HTMLButtonElement>(".prp-insert-description")
    await act(async () => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    })

    expect(button?.textContent).toBe("Field not found")

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    expect(button?.textContent).toBe("Insert into description")

    act(() => root.unmount())
  })
})
