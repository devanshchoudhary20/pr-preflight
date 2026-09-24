export type BadgeState = "loading" | "error" | "empty" | "success"
export type Severity = "pass" | "warn" | "flag" | null

interface BadgeProps {
  state: BadgeState
  label: string
  count: number
  severity: Severity
  onClick: () => void
}

// Chunk 1 has no findings yet, so "success" reads as a file count, not a
// review count; chunk 2 swaps this line for the real "{n} to review" copy.
const STATE_TEXT: Record<BadgeState, (count: number) => string> = {
  loading: () => "Checking…",
  error: () => "Preflight unavailable",
  empty: () => "No changes on this branch yet.",
  success: (count) => `${count} file${count === 1 ? "" : "s"} changed`
}

const STATE_DOT_CLASS: Record<BadgeState, string> = {
  loading: "prp-dot-neutral",
  error: "prp-dot-warn",
  empty: "prp-dot-pass",
  success: "prp-dot-neutral"
}

export function Badge({ state, label, count, severity, onClick }: BadgeProps) {
  const safeCount = Number.isFinite(count) ? count : 0
  const text = STATE_TEXT[state](safeCount)
  const dotClass = severity ? `prp-dot-${severity}` : STATE_DOT_CLASS[state]

  return (
    <button type="button" className="prp-badge" onClick={onClick} aria-label={`${label}: ${text}`}>
      <span className={`prp-dot ${dotClass}`} aria-hidden="true" />
      <span className="prp-badge-label">{label}</span>
      <span className="prp-badge-text">{text}</span>
    </button>
  )
}
