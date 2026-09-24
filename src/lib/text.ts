export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`
}

// Shared across lib (diff.ts, domDiff.ts) and content (copy.ts, markdown.ts, CheckRow.tsx); lib must not import content.
export const UNKNOWN_FILE_FALLBACK = "(unknown file)"
