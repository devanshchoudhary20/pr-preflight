export type BadgeState = "loading" | "error" | "empty" | "success"
export type Severity = "pass" | "warn" | "flag" | null

interface BadgeProps {
  state: BadgeState
  label: string
  count: number
  severity: Severity
  onClick: () => void
}

const STATE_TEXT: Record<BadgeState, (count: number) => string> = {
  loading: () => "Checking…",
  error: () => "Preflight unavailable",
  empty: () => "All clear",
  success: (count) => `${count} to review`
}

const STATE_DOT_CLASS: Record<BadgeState, string> = {
  loading: "prp-dot-neutral",
  error: "prp-dot-warn",
  empty: "prp-dot-pass",
  success: "prp-dot-neutral"
}

export function Badge({ state, label, count, severity, onClick }: BadgeProps) {
  const text = STATE_TEXT[state](count)
  const dotClass = severity ? `prp-dot-${severity}` : STATE_DOT_CLASS[state]

  return (
    <button type="button" className="prp-badge" onClick={onClick} aria-label={`${label}: ${text}`}>
      <span className={`prp-dot ${dotClass}`} aria-hidden="true" />
      <span className="prp-badge-label">{label}</span>
      <span className="prp-badge-text">{text}</span>
    </button>
  )
}
