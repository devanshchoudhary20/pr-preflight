import { useEffect, useState } from "react"
import { Badge } from "./Badge"
import { Panel, type PanelLoadState } from "./Panel"
import { fetchDiff, parseDiff, diffStats, DiffFetchError, type DiffStats } from "../lib/diff"
import { runChecks, worstLevel, type Finding } from "../lib/checks"
import { FETCH_ERROR_FALLBACK } from "./copy"
import type { CompareUrl } from "../lib/url"

interface ContentAppProps {
  compareUrl: CompareUrl | null
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
  const [findings, setFindings] = useState<Finding[] | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [retryToken, setRetryToken] = useState(0)

  useEffect(() => {
    // A null compareUrl means the URL parser couldn't read a range (should
    // not happen inside this content script's own match pattern); screens.md
    // keeps this as the Loading state with the "this branch" label fallback
    // rather than surfacing an error for a page we can't identify.
    if (!compareUrl) return
    const controller = new AbortController()
    fetchDiff(compareUrl.owner, compareUrl.repo, compareUrl.range, { signal: controller.signal })
      .then((text) => {
        const files = parseDiff(text)
        const nextStats = diffStats(files)
        setStats(nextStats)
        setFindings(runChecks(files))
        setLoadState(nextStats.files === 0 ? "empty" : "ready")
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return
        setErrorMessage(toErrorMessage(err))
        setLoadState("error")
      })
    return () => controller.abort()
  }, [compareUrl, retryToken])

  function handleRetry(): void {
    setLoadState("loading")
    setErrorMessage(null)
    setRetryToken((n) => n + 1)
  }

  const worst = findings ? worstLevel(findings) : null
  const reviewCount = findings ? findings.filter((finding) => finding.level !== "pass").length : 0

  let badgeState: "loading" | "error" | "empty" | "success" = "loading"
  if (loadState === "loading") badgeState = "loading"
  else if (loadState === "error") badgeState = "error"
  else badgeState = worst === null ? "empty" : "success"

  return (
    <>
      {!expanded && (
        <Badge
          state={badgeState}
          label="PR Preflight"
          count={reviewCount}
          severity={worst}
          onClick={() => setExpanded(true)}
        />
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
