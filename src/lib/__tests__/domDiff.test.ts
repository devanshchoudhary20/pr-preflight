// @vitest-environment jsdom
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest"
import { parseDomDiff } from "../domDiff"

const FIXTURE = `
  <div id="files_bucket">
    <div class="file" data-tagsearch-path="src/a.ts">
      <span class="diffstat" aria-label="2 additions &amp; 1 deletion"></span>
      <table>
        <tbody>
          <tr>
            <td data-line-number="1"></td>
            <td data-line-number="1"></td>
            <td class="blob-code blob-code-context"><span class="blob-code-inner"> line1</span></td>
          </tr>
          <tr>
            <td data-line-number=""></td>
            <td data-line-number="2"></td>
            <td class="blob-code blob-code-addition"><span class="blob-code-inner">+added line</span></td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="file" data-tagsearch-path="README.md">
      <span class="diffstat" aria-label="1 addition &amp; 0 deletions"></span>
      <table>
        <tbody>
          <tr>
            <td data-line-number=""></td>
            <td data-line-number="4"></td>
            <td class="blob-code blob-code-addition"><span class="blob-code-inner">+world</span></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
`

describe("parseDomDiff", () => {
  beforeEach(() => {
    document.body.innerHTML = FIXTURE
  })

  it("collects path, added lines with line numbers, and diffstat per file", async () => {
    const files = await parseDomDiff()
    expect(files).toHaveLength(2)
    expect(files[0].path).toBe("src/a.ts")
    expect(files[0].additions).toBe(2)
    expect(files[0].deletions).toBe(1)
    expect(files[0].addedLines).toEqual([{ lineNo: 2, content: "+added line" }])
    expect(files[1].path).toBe("README.md")
    expect(files[1].addedLines).toEqual([{ lineNo: 4, content: "+world" }])
  })

  it("falls back to an undefined line number when no adjacent data-line-number cell is present", async () => {
    document.body.innerHTML = `
      <div id="files_bucket">
        <div class="file" data-tagsearch-path="no-line-numbers.txt">
          <span class="diffstat" aria-label="1 addition &amp; 0 deletions"></span>
          <table>
            <tbody>
              <tr><td class="blob-code blob-code-addition"><span class="blob-code-inner">+hi</span></td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `
    const [file] = await parseDomDiff()
    expect(file.addedLines).toEqual([{ lineNo: undefined, content: "+hi" }])
  })

  it("resolves with an empty array when #files_bucket never populates within the 10s timeout", async () => {
    document.body.innerHTML = `<div id="files_bucket"></div>`
    vi.useFakeTimers()
    const pending = parseDomDiff()
    await vi.advanceTimersByTimeAsync(10000)
    await expect(pending).resolves.toEqual([])
  })

  afterEach(() => {
    vi.useRealTimers()
  })
})
