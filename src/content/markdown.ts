import type { Finding, FindingItem } from "../lib/checks/types"
import { formatItem } from "../lib/checks/format"

// item.snippet is already the pattern name (never the raw match) for the secrets check, so this sub-bullet is safe to paste publicly.
function formatItemLine(item: FindingItem): string {
  const { label, snippet } = formatItem(item)
  const snippetSuffix = snippet ? ` — ${snippet}` : ""
  return `  - ${label}${snippetSuffix}`
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
