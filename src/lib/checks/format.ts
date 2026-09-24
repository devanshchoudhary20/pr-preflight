import type { FindingItem } from "./types"
import { truncateSnippet } from "./utils"
import { UNKNOWN_FILE_FALLBACK } from "../text"

export interface FormattedItem {
  label: string
  snippet: string
}

// Shared by the panel row (CheckRow) and "copy as markdown" (markdown.ts); snippet is "" when empty so each caller picks its own fallback.
export function formatItem(item: FindingItem): FormattedItem {
  const path = item.path.trim() || UNKNOWN_FILE_FALLBACK
  const lineSuffix = typeof item.line === "number" ? `:${item.line}` : ""
  const trimmedSnippet = item.snippet?.trim() ?? ""
  return { label: `${path}${lineSuffix}`, snippet: trimmedSnippet ? truncateSnippet(trimmedSnippet) : "" }
}
