import type { DiffFile } from "../diff"
import type { Finding, FindingItem } from "./types"
import { isTestFile, stripAddedPrefix, truncateSnippet } from "./utils"

const GENERAL_PATTERNS = [
  /console\.(log|debug|trace)\(/,
  /\bdebugger\b/,
  /binding\.pry/,
  /byebug/,
  /\bdd\(/,
  /var_dump\(/
]

const PYTHON_PRINT_PATTERN = /^\s*print\(/

export function checkDebugLeftovers(files: DiffFile[]): Finding {
  const items: FindingItem[] = []
  for (const file of files) {
    if (isTestFile(file.path)) continue
    const patterns = file.path.endsWith(".py") ? [...GENERAL_PATTERNS, PYTHON_PRINT_PATTERN] : GENERAL_PATTERNS
    for (const addedLine of file.addedLines) {
      const content = stripAddedPrefix(addedLine.content)
      if (patterns.some((pattern) => pattern.test(content))) {
        items.push({ path: file.path, line: addedLine.lineNo, snippet: truncateSnippet(content) })
      }
    }
  }
  const level = items.length > 0 ? "warn" : "pass"
  const title =
    level === "warn"
      ? `${items.length} debug leftover${items.length === 1 ? "" : "s"} found`
      : "No debug leftovers found"
  return { id: "debug-leftovers", level, title, items }
}
