import type { Finding, FindingItem } from "../lib/checks/types"
import { truncateSnippet } from "../lib/checks/utils"
import { UNKNOWN_FILE_FALLBACK } from "./copy"

// item.snippet is already the pattern name (never the raw match) for the secrets check, so this sub-bullet is safe to paste publicly.
function formatItemLine(item: FindingItem): string {
  const path = item.path?.trim() || UNKNOWN_FILE_FALLBACK
  const lineSuffix = typeof item.line === "number" ? `:${item.line}` : ""
  const snippet = item.snippet?.trim()
  const snippetSuffix = snippet ? ` — ${truncateSnippet(snippet)}` : ""
  return `  - ${path}${lineSuffix}${snippetSuffix}`
}

export function formatFindingsAsMarkdown(findings: Finding[], checkedIds: Set<string>): string {
  const lines: string[] = []
  for (const finding of findings) {
    const box = checkedIds.has(finding.id) ? "[x]" : "[ ]"
    lines.push(`- ${box} ${finding.title.trim() || "Check"}`)
    for (const item of finding.items) lines.push(formatItemLine(item))
  }
  lines.push("_via PR Preflight_")
  return lines.join("\n")
}
