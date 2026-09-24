export const FETCH_ERROR_FALLBACK = "GitHub returned an error fetching this diff (unknown). Try again in a moment."
export const EMPTY_DIFF_COPY = "No changes on this branch yet."
export const RUNNING_CHECKS_COPY = "Running checks…"
export const UNKNOWN_FILE_FALLBACK = "(unknown file)"
export const NO_PREVIEW_FALLBACK = "(no preview)"

export function pluralFiles(n: number): string {
  const safeCount = Number.isFinite(n) ? n : 0
  return `${safeCount} file${safeCount === 1 ? "" : "s"} changed`
}
