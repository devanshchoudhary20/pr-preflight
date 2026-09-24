import { selectors } from "./selectors"
import type { AddedLine, DiffFile } from "./diff"

const FALLBACK_TIMEOUT_MS = 10000
const DIFFSTAT_PATTERN = /(\d+)\s*addition[s]?.*?(\d+)\s*deletion[s]?/i

function hasFileRows(): boolean {
  return document.querySelectorAll(selectors.fileRow).length > 0
}

// #files_bucket loads its rows via an <include-fragment>; resolve on whichever
// signal comes first (its "load" event or the bucket actually gaining rows),
// capped at 10s so a stalled fragment can't hang the fallback forever.
function waitForFilesBucket(): Promise<void> {
  return new Promise((resolve) => {
    if (hasFileRows()) {
      resolve()
      return
    }

    let settled = false
    const finish = (): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      fragment?.removeEventListener("load", onLoad)
      observer.disconnect()
      resolve()
    }

    const fragment = document.querySelector(selectors.includeFragment)
    const onLoad = (): void => finish()
    fragment?.addEventListener("load", onLoad, { once: true })

    const observer = new MutationObserver(() => {
      if (hasFileRows()) finish()
    })
    const bucket = document.querySelector(selectors.filesBucket)
    observer.observe(bucket ?? document.body, { childList: true, subtree: true })

    const timer = setTimeout(finish, FALLBACK_TIMEOUT_MS)
  })
}

// The populated line-number cell is the one adjacent to the code cell (the
// blank old-side cell on an added line has no data-line-number), so take the
// last match in the row rather than the first.
function extractLineNumber(row: Element | null): number | undefined {
  if (!row) return undefined
  const cells = row.querySelectorAll("td[data-line-number]")
  const attr = cells[cells.length - 1]?.getAttribute("data-line-number")
  const parsed = attr ? Number(attr) : NaN
  return Number.isFinite(parsed) ? parsed : undefined
}

function extractAddedLines(fileEl: Element): AddedLine[] {
  return Array.from(fileEl.querySelectorAll(selectors.addedLine)).map((inner) => ({
    lineNo: extractLineNumber(inner.closest("tr")),
    content: inner.textContent ?? ""
  }))
}

function extractDiffStat(fileEl: Element): { additions: number; deletions: number } {
  const stat = fileEl.querySelector(selectors.diffStat)
  const label = stat?.getAttribute("aria-label") || stat?.textContent || ""
  const match = label.match(DIFFSTAT_PATTERN)
  if (!match) return { additions: 0, deletions: 0 }
  return { additions: Number(match[1]) || 0, deletions: Number(match[2]) || 0 }
}

// Mirrors resolvePath's inline fallback in diff.ts rather than importing it,
// since that literal already lives duplicated there instead of in a shared constant.
function parseFileElement(fileEl: Element): DiffFile {
  const path = fileEl.getAttribute(selectors.filePathAttr) || "(unknown file)"
  const { additions, deletions } = extractDiffStat(fileEl)
  return { path, additions, deletions, addedLines: extractAddedLines(fileEl) }
}

export async function parseDomDiff(): Promise<DiffFile[]> {
  await waitForFilesBucket()
  return Array.from(document.querySelectorAll(selectors.fileRow)).map(parseFileElement)
}
