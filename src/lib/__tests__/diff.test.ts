import { afterEach, describe, expect, it, vi } from "vitest"
import { parseDiff, diffStats, fetchDiff, DiffTooLargeError, DIFF_SIZE_CAP_BYTES } from "../diff"

const FIXTURE = `diff --git a/src/a.ts b/src/a.ts
index 1111111..2222222 100644
--- a/src/a.ts
+++ b/src/a.ts
@@ -1,4 +1,4 @@
 line1
+added line
 line2
-removed line
 line3
diff --git a/README.md b/README.md
index 3333333..4444444 100644
--- a/README.md
+++ b/README.md
@@ -1,2 +1,3 @@
 hello
+world
 bye
`

describe("diffStats", () => {
  it("totals files, additions, and deletions across the parsed diff", () => {
    const files = parseDiff(FIXTURE)
    expect(diffStats(files)).toEqual({ files: 2, additions: 2, deletions: 1 })
  })

  it("collects added lines with their line numbers per file", () => {
    const [first] = parseDiff(FIXTURE)
    expect(first.path).toBe("src/a.ts")
    expect(first.addedLines).toEqual([{ lineNo: 2, content: "+added line" }])
  })

  it("returns zeroed stats for an empty diff", () => {
    expect(diffStats(parseDiff(""))).toEqual({ files: 0, additions: 0, deletions: 0 })
  })
})

function stubResponse(overrides: Record<string, unknown>): Response {
  return {
    ok: true,
    status: 200,
    headers: { get: () => null },
    text: async () => "",
    ...overrides
  } as unknown as Response
}

describe("fetchDiff size cap", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("rejects with the declared MB and never reads the body when content-length exceeds the cap", async () => {
    vi.stubGlobal("location", { origin: "https://github.com" })
    const cancel = vi.fn().mockResolvedValue(undefined)
    const response = stubResponse({
      headers: { get: (key: string) => (key === "content-length" ? String(3 * 1024 * 1024) : null) },
      body: { cancel }
    })
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response))

    await expect(fetchDiff("octocat", "hello-world", "main...feature")).rejects.toMatchObject({
      name: "DiffTooLargeError",
      sizeMb: "3.0"
    })
    expect(cancel).toHaveBeenCalled()
  })

  it("aborts mid-stream past the cap with an 'over 2' size when content-length is absent", async () => {
    vi.stubGlobal("location", { origin: "https://github.com" })
    const chunk = new Uint8Array(DIFF_SIZE_CAP_BYTES + 10)
    let reads = 0
    const reader = {
      read: async () => {
        reads += 1
        return reads === 1 ? { done: false, value: chunk } : { done: true, value: undefined }
      },
      cancel: vi.fn().mockResolvedValue(undefined)
    }
    const response = stubResponse({ body: { getReader: () => reader } })
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response))

    const err = await fetchDiff("octocat", "hello-world", "main...feature").catch((e) => e)
    expect(err).toBeInstanceOf(DiffTooLargeError)
    expect(err.sizeMb).toBe("over 2")
    expect(reader.cancel).toHaveBeenCalled()
  })

  it("returns the text when under the cap and no reader is available", async () => {
    vi.stubGlobal("location", { origin: "https://github.com" })
    const response = stubResponse({ text: async () => "diff --git a/a b/a\n" })
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response))

    await expect(fetchDiff("octocat", "hello-world", "main...feature")).resolves.toBe("diff --git a/a b/a\n")
  })
})
