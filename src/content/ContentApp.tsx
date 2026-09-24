import { useEffect, useRef, useState } from "react"
import { Badge } from "./Badge"
import { deriveBadgeState } from "./badgeState"
import { Panel, type PanelLoadState } from "./Panel"
import { fetchDiff, parseDiff, diffStats, DiffFetchError, DiffTooLargeError, type DiffFile, type DiffStats } from "../lib/diff"
import { parseDomDiff } from "../lib/domDiff"
import { runChecks, worstLevel, type Finding } from "../lib/checks"
import { diffTooLargeFinding } from "../lib/checks/diffSize"
import { DEFAULT_CONFIG, type CheckConfig } from "../lib/checks/types"
import { loadConfig, onConfigChange } from "../lib/settings"
import { FETCH_ERROR_FALLBACK, COMBINED_ERROR_HEADING, COMBINED_ERROR_BODY } from "./copy"
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

// Network/5xx are transient (worth a DOM fallback); 401/403/404 mean the compare itself is unreachable.
function isRecoverableFetchError(err: DiffFetchError): boolean {
  return err.status === undefined || err.status >= 500
}

export function ContentApp({ compareUrl }: ContentAppProps) {
  const [expanded, setExpanded] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const [loadState, setLoadState] = useState<PanelLoadState>("loading")
  const [stats, setStats] = useState<DiffStats | null>(null)
  const [files, setFiles] = useState<DiffFile[] | null>(null)
  const [syntheticFindings, setSyntheticFindings] = useState<Finding[] | null>(null)
  const [config, setConfig] = useState<CheckConfig>(DEFAULT_CONFIG)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [errorHeading, setErrorHeading] = useState<string | null>(null)
  const [retryToken, setRetryToken] = useState(0)

  // Config loads independently of the diff fetch; a threshold/toggle change re-runs checks without refetching.
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
    const { owner, repo, range } = compareUrl
    const controller = new AbortController()
    let cancelled = false

    async function run(): Promise<void> {
      try {
        const text = await fetchDiff(owner, repo, range, { signal: controller.signal })
        if (cancelled) return
        const parsedFiles = parseDiff(text)
        setFiles(parsedFiles)
        setStats(diffStats(parsedFiles))
        setLoadState(parsedFiles.length === 0 ? "empty" : "ready")
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return
        if (cancelled) return

        if (err instanceof DiffTooLargeError) {
          const domFiles = await parseDomDiff().catch(() => [])
          if (cancelled) return
          setFiles(null)
          setStats(domFiles.length > 0 ? diffStats(domFiles) : null)
          setSyntheticFindings([diffTooLargeFinding(err.sizeMb)])
          setLoadState("ready")
          return
        }

        if (err instanceof DiffFetchError && isRecoverableFetchError(err)) {
          const domFiles = await parseDomDiff().catch(() => [])
          if (cancelled) return
          if (domFiles.length > 0) {
            setFiles(domFiles)
            setStats(diffStats(domFiles))
            setLoadState("ready")
            return
          }
          setErrorHeading(COMBINED_ERROR_HEADING)
          setErrorMessage(COMBINED_ERROR_BODY)
          setLoadState("error")
          return
        }

        setErrorHeading(null)
        setErrorMessage(toErrorMessage(err))
        setLoadState("error")
      }
    }

    run()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [compareUrl, retryToken])

  // Derived during render, not an effect: findings depend only on files/config/syntheticFindings, all already React state.
  const findings = syntheticFindings ?? (files ? runChecks(files, config) : null)

  function handleRetry(): void {
    setLoadState("loading")
    setErrorMessage(null)
    setErrorHeading(null)
    setSyntheticFindings(null)
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
    function handleMessage(message: unknown, sender: chrome.runtime.MessageSender, sendResponse: (response: TabState | { ok: true }) => void): void {
      if (sender.id !== chrome.runtime.id) return
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

  // Collapse on any click outside the panel; composedPath (not target) so a click inside the shadow DOM is detected correctly.
  useEffect(() => {
    if (!expanded) return
    function handleOutsideClick(event: MouseEvent): void {
      if (rootRef.current && !event.composedPath().includes(rootRef.current)) setExpanded(false)
    }
    document.addEventListener("mousedown", handleOutsideClick)
    return () => document.removeEventListener("mousedown", handleOutsideClick)
  }, [expanded])

  return (
    <div ref={rootRef}>
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
          errorHeading={errorHeading}
          onRetry={handleRetry}
          onCollapse={() => setExpanded(false)}
        />
      )}
    </div>
  )
}
