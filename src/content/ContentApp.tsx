import { useEffect, useState } from "react"
import { Badge } from "./Badge"
import { Panel, type PanelLoadState } from "./Panel"
import { fetchDiff, parseDiff, diffStats, DiffFetchError, type DiffStats } from "../lib/diff"
import type { CompareUrl } from "../lib/url"

interface ContentAppProps {
  compareUrl: CompareUrl | null
}

function toErrorMessage(err: unknown): string {
  if (err instanceof DiffFetchError) {
    const status = err.status ?? "unknown"
    return `GitHub returned an error fetching this diff (${status}). Try again in a moment.`
  }
  return "GitHub returned an error fetching this diff (unknown). Try again in a moment."
}

export function ContentApp({ compareUrl }: ContentAppProps) {
  const [expanded, setExpanded] = useState(false)
  const [loadState, setLoadState] = useState<PanelLoadState>("loading")
  const [stats, setStats] = useState<DiffStats | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [retryToken, setRetryToken] = useState(0)

  useEffect(() => {
    // A null compareUrl means the URL parser couldn't read a range (should
    // not happen inside this content script's own match pattern); screens.md
    // keeps this as the Loading state with the "this branch" label fallback
    // rather than surfacing an error for a page we can't identify.
    if (!compareUrl) return
    const controller = new AbortController()
    // Initial state is already "loading"; only reset it on a retry so the
    // effect doesn't fire a redundant synchronous setState on first mount.
    if (retryToken > 0) {
      setLoadState("loading")
      setErrorMessage(null)
    }
    fetchDiff(compareUrl.owner, compareUrl.repo, compareUrl.range, { signal: controller.signal })
      .then((text) => {
        const files = parseDiff(text)
        setStats(diffStats(files))
        setLoadState("ready")
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return
        setErrorMessage(toErrorMessage(err))
        setLoadState("error")
      })
    return () => controller.abort()
  }, [compareUrl, retryToken])

  const badgeLabel = "PR Preflight"
  const badgeCount = stats?.files ?? 0
  let badgeState: "loading" | "error" | "empty" | "success" = "loading"
  if (loadState === "loading") badgeState = "loading"
  else if (loadState === "error") badgeState = "error"
  else badgeState = badgeCount === 0 ? "empty" : "success"

  return (
    <>
      {!expanded && (
        <Badge
          state={badgeState}
          label={badgeLabel}
          count={badgeCount}
          severity={null}
          onClick={() => setExpanded(true)}
        />
      )}
      {expanded && (
        <Panel
          compareUrl={compareUrl}
          loadState={loadState}
          stats={stats}
          errorMessage={errorMessage}
          onRetry={() => setRetryToken((n) => n + 1)}
          onCollapse={() => setExpanded(false)}
        />
      )}
    </>
  )
}
