import type { PanelLoadState } from "./Panel"

// "empty" (zero-file diff) is distinct from "all-clear" (a real diff where every check passed); popup mirrors this exact mapping.
export type BadgeState = "loading" | "error" | "empty" | "all-clear" | "success"
export type Severity = "pass" | "warn" | "flag" | null

export const BADGE_STATE_TEXT: Record<BadgeState, (count: number) => string> = {
  loading: () => "Checking…",
  error: () => "Preflight unavailable",
  empty: () => "No changes on this branch yet.",
  "all-clear": () => "All clear",
  success: (count) => `${count} to review`
}

const STATE_DOT_CLASS: Record<BadgeState, string> = {
  loading: "prp-dot-neutral",
  error: "prp-dot-warn",
  empty: "prp-dot-pass",
  "all-clear": "prp-dot-pass",
  success: "prp-dot-neutral"
}

export function badgeDotClass(state: BadgeState, severity: Severity): string {
  return severity ? `prp-dot-${severity}` : STATE_DOT_CLASS[state]
}

export function deriveBadgeState(loadState: PanelLoadState, worst: Severity): BadgeState {
  if (loadState === "loading") return "loading"
  if (loadState === "error") return "error"
  if (loadState === "empty") return "empty"
  return worst === null ? "all-clear" : "success"
}
