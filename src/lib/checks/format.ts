import type { FindingItem } from "./types"
import { truncateSnippet } from "./utils"
import { UNKNOWN_FILE_FALLBACK } from "../text"

export interface FormattedItem {
  label: string
  snippet: string
}

// Shared path/line/snippet formatting for the panel row (CheckRow) and the "copy as markdown" export (markdown.ts).
// snippet is returned as "" when empty; each caller picks its own empty fallback (inline text vs. an omitted suffix).
export function formatItem(item: FindingItem): FormattedItem {
  const path = item.path.trim() || UNKNOWN_FILE_FALLBACK
  const lineSuffix = typeof item.line === "number" ? `:${item.line}` : ""
  const trimmedSnippet = item.snippet?.trim() ?? ""
  return { label: `${path}${lineSuffix}`, snippet: trimmedSnippet ? truncateSnippet(trimmedSnippet) : "" }
}
