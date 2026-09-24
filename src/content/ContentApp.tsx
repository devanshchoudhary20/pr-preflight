import { useEffect, useRef, useState } from "react"
import { Badge } from "./Badge"
import { deriveBadgeState } from "./badgeState"
import { Panel, type PanelLoadState } from "./Panel"
import { fetchDiff, parseDiff, diffStats, DiffFetchError, type DiffFile, type DiffStats } from "../lib/diff"
import { runChecks, worstLevel, type Finding } from "../lib/checks"
import { DEFAULT_CONFIG, type CheckConfig } from "../lib/checks/types"
import { loadConfig, onConfigChange } from "../lib/settings"
import { FETCH_ERROR_FALLBACK } from "./copy"
import type { CompareUrl } from "../lib/url"

interface ContentAppProps {
  compareUrl: CompareUrl | null
}

export interface TabState {
  loadState: PanelLoadState
  worst: Finding["level"] | null
  count: number
}

function toErrorMessage(err: unknown): string {
  if (err instanceof DiffFetchError) {
    const status = err.status ?? "unknown"
    return `GitHub returned an error fetching this diff (${status}). Try again in a moment.`
  }
  return FETCH_ERROR_FALLBACK
}

export function ContentApp({ compareUrl }: ContentAppProps) {
  const [expanded, setExpanded] = useState(false)
  const [loadState, setLoadState] = useState<PanelLoadState>("loading")
  const [stats, setStats] = useState<DiffStats | null>(null)
  const [files, setFiles] = useState<DiffFile[] | null>(null)
  const [config, setConfig] = useState<CheckConfig>(DEFAULT_CONFIG)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [retryToken, setRetryToken] = useState(0)

  // Config loads independently of the diff fetch and re-runs checks on the
  // already-parsed files below, never refetching the diff on a threshold/toggle change.
  useEffect(() => {
    let cancelled = false
    loadConfig().then((loaded) => {
      if (!cancelled) setConfig(loaded)
    })
    const unsubscribe = onConfigChange((next) => setConfig(next))
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!compareUrl) return
    const controller = new AbortController()
    fetchDiff(compareUrl.owner, compareUrl.repo, compareUrl.range, { signal: controller.signal })
      .then((text) => {
        const parsedFiles = parseDiff(text)
        setFiles(parsedFiles)
        setStats(diffStats(parsedFiles))
        setLoadState(parsedFiles.length === 0 ? "empty" : "ready")
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return
        setErrorMessage(toErrorMessage(err))
        setLoadState("error")
      })
    return () => controller.abort()
  }, [compareUrl, retryToken])

  // Derived during render, not an effect: findings depend only on files/config, both already React state.
  const findings = files ? runChecks(files, config) : null

  function handleRetry(): void {
    setLoadState("loading")
    setErrorMessage(null)
    setFiles(null)
    setRetryToken((n) => n + 1)
  }

  const worst = findings ? worstLevel(findings) : null
  const reviewCount = findings ? findings.filter((finding) => finding.level !== "pass").length : 0
  const badgeState = deriveBadgeState(loadState, worst)

  const tabStateRef = useRef<TabState>({ loadState, worst, count: reviewCount })
  useEffect(() => {
    tabStateRef.current = { loadState, worst, count: reviewCount }
  }, [loadState, worst, reviewCount])

  useEffect(() => {
    function handleMessage(message: unknown, _sender: chrome.runtime.MessageSender, sendResponse: (response: TabState | { ok: true }) => void): void {
      const type = message && typeof message === "object" ? (message as { type?: string }).type : undefined
      if (type === "prp:state") {
        sendResponse(tabStateRef.current)
      } else if (type === "prp:expand") {
        setExpanded(true)
        sendResponse({ ok: true })
      }
    }
    chrome.runtime.onMessage.addListener(handleMessage)
    return () => chrome.runtime.onMessage.removeListener(handleMessage)
  }, [])

  return (
    <>
      {!expanded && (
        <Badge state={badgeState} label="PR Preflight" count={reviewCount} severity={worst} onClick={() => setExpanded(true)} />
      )}
      {expanded && (
        <Panel
          compareUrl={compareUrl}
          loadState={loadState}
          stats={stats}
          findings={findings}
          errorMessage={errorMessage}
          onRetry={handleRetry}
          onCollapse={() => setExpanded(false)}
        />
      )}
    </>
  )
}
