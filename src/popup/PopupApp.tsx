import { useEffect, useState } from "react"
import { parseCompareUrl } from "../lib/url"
import { BADGE_STATE_TEXT, badgeDotClass, deriveBadgeState, type BadgeState, type Severity } from "../content/badgeState"
import type { TabState } from "../content/ContentApp"
import "./popup.css"

type Phase = "loading" | "error" | "compare" | "github" | "other"

const EXPLAINER_COPY = "Open a compare page on GitHub to see your preflight checklist."
const UNREACHABLE_COPY = "Couldn't reach this tab. Reload the GitHub page and try again."

interface CompareState {
  tabId: number
  badgeState: BadgeState
  count: number
  severity: Severity
}

async function resolveActiveTab(): Promise<CompareState | "github" | "other"> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  const url = tab?.url ?? ""
  if (!url) return "other"
  const parsedUrl = new URL(url)
  if (parsedUrl.hostname !== "github.com") return "other"
  const compareUrl = parseCompareUrl(parsedUrl.pathname)
  if (!compareUrl) return "github"
  if (typeof tab.id !== "number") throw new Error("active tab has no id")
  const response = (await chrome.tabs.sendMessage(tab.id, { type: "prp:state" })) as TabState
  const worst = response?.worst ?? null
  return {
    tabId: tab.id,
    badgeState: deriveBadgeState(response?.loadState ?? "loading", worst),
    count: response?.count ?? 0,
    severity: worst
  }
}

export function PopupApp() {
  const [phase, setPhase] = useState<Phase>("loading")
  const [compareState, setCompareState] = useState<CompareState | null>(null)

  useEffect(() => {
    let cancelled = false
    resolveActiveTab()
      .then((result) => {
        if (cancelled) return
        if (result === "github" || result === "other") {
          setPhase(result)
          return
        }
        setCompareState(result)
        setPhase("compare")
      })
      .catch(() => {
        if (!cancelled) setPhase("error")
      })
    return () => {
      cancelled = true
    }
  }, [])

  function handleOpenPanel(): void {
    if (!compareState) return
    void chrome.tabs.sendMessage(compareState.tabId, { type: "prp:expand" })
    window.close()
  }

  function handleOpenSettings(): void {
    chrome.runtime.openOptionsPage()
  }

  function handleGoToGithub(): void {
    void chrome.tabs.create({ url: "https://github.com" })
    window.close()
  }

  const statusText = compareState ? BADGE_STATE_TEXT[compareState.badgeState](compareState.count) : ""
  const dotClass = compareState ? badgeDotClass(compareState.badgeState, compareState.severity) : "prp-dot-neutral"

  return (
    <div className="prp-root prp-popup">
      {phase === "loading" && <p className="prp-popup-status">Checking this tab…</p>}
      {phase === "error" && <p className="prp-popup-status">{UNREACHABLE_COPY}</p>}
      {(phase === "github" || phase === "other") && <p className="prp-popup-status">{EXPLAINER_COPY}</p>}
      {phase === "compare" && (
        <div className="prp-popup-state">
          <span className={`prp-dot ${dotClass}`} aria-hidden="true" />
          <span>{statusText}</span>
        </div>
      )}
      <div className="prp-popup-actions">
        {phase === "compare" && (
          <button type="button" onClick={handleOpenPanel}>
            Open panel
          </button>
        )}
        {phase === "other" && (
          <button type="button" onClick={handleGoToGithub}>
            Go to GitHub
          </button>
        )}
        <button type="button" onClick={handleOpenSettings}>
          Settings
        </button>
      </div>
    </div>
  )
}
