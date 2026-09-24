import { BADGE_STATE_TEXT, badgeDotClass, type BadgeState, type Severity } from "./badgeState"

interface BadgeProps {
  state: BadgeState
  label: string
  count: number
  severity: Severity
  onClick: () => void
}

export function Badge({ state, label, count, severity, onClick }: BadgeProps) {
  const text = BADGE_STATE_TEXT[state](count)
  const dotClass = badgeDotClass(state, severity)

  return (
    <button type="button" className="prp-badge" onClick={onClick} aria-label={`${label}: ${text}`}>
      <span className={`prp-dot ${dotClass}`} aria-hidden="true" />
      <span className="prp-badge-label">{label}</span>
      <span className="prp-badge-text">{text}</span>
    </button>
  )
}
