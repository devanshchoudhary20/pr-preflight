import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { installChromeStorageStub } from "./chromeStorageStub"
import { loadTicks, setTick } from "../ticks"

beforeEach(() => {
  installChromeStorageStub()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("ticks", () => {
  it("persists a tick per owner/repo/range and reads it back", async () => {
    await setTick("octocat", "hello-world", "main...feature", "todo-markers", true)
    const ticks = await loadTicks("octocat", "hello-world", "main...feature")
    expect(ticks.has("todo-markers")).toBe(true)
    expect(await loadTicks("octocat", "other-repo", "main...feature")).toEqual(new Set())
  })

  it("unticks a previously ticked finding", async () => {
    await setTick("octocat", "hello-world", "main...feature", "secrets", true)
    await setTick("octocat", "hello-world", "main...feature", "secrets", false)
    const ticks = await loadTicks("octocat", "hello-world", "main...feature")
    expect(ticks.has("secrets")).toBe(false)
  })

  it("prunes ticks older than 7 days on read", async () => {
    vi.useFakeTimers()
    const start = new Date("2026-01-01T00:00:00Z")
    vi.setSystemTime(start)
    await setTick("octocat", "hello-world", "main...feature", "secrets", true)
    vi.setSystemTime(new Date(start.getTime() + 8 * 24 * 60 * 60 * 1000))
    const ticks = await loadTicks("octocat", "hello-world", "main...feature")
    expect(ticks.size).toBe(0)
  })
})
