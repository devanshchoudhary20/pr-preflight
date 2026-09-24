import type { CompareUrl } from "../lib/url"
import type { DiffStats } from "../lib/diff"

export type PanelLoadState = "loading" | "error" | "ready"

interface PanelProps {
  compareUrl: CompareUrl | null
  loadState: PanelLoadState
  stats: DiffStats | null
  errorMessage: string | null
  onRetry: () => void
  onCollapse: () => void
}

const FALLBACK_ERROR = "GitHub returned an error fetching this diff (unknown). Try again in a moment."

export function Panel({ compareUrl, loadState, stats, errorMessage, onRetry, onCollapse }: PanelProps) {
  const owner = compareUrl?.owner ?? "unknown"
  const repo = compareUrl?.repo ?? "repo"
  const range = compareUrl?.range ?? "this branch"
  const fileCount = stats?.files ?? 0
  const additions = stats?.additions ?? 0
  const deletions = stats?.deletions ?? 0

  const isLoading = loadState === "loading"
  const isError = loadState === "error"
  const isReady = loadState === "ready"
  const isEmpty = isReady && fileCount === 0
  const isSuccess = isReady && !isEmpty

  const statsLine = `${fileCount} file${fileCount === 1 ? "" : "s"} changed`
  const errorText = errorMessage ?? FALLBACK_ERROR

  return (
    <div className="prp-panel" role="dialog" aria-label="PR Preflight">
      <div className="prp-panel-header">
        <div className="prp-panel-title">
          <span className="prp-panel-repo">
            {owner}/{repo}
          </span>
          <span className="prp-panel-range">{range}</span>
        </div>
        <button type="button" className="prp-panel-collapse" onClick={onCollapse} aria-label="Collapse panel">
          ×
        </button>
      </div>
      <div className="prp-panel-body">
        {isLoading && <p className="prp-panel-status">Fetching diff…</p>}
        {isError && (
          <div className="prp-panel-error">
            <p>{errorText}</p>
            <button type="button" onClick={onRetry}>
              Retry
            </button>
          </div>
        )}
        {isEmpty && <p className="prp-panel-status">No changes on this branch yet.</p>}
        {isSuccess && (
          <p className="prp-panel-stats">
            {statsLine} <span className="prp-additions">+{additions}</span>{" "}
            <span className="prp-deletions">−{deletions}</span>
          </p>
        )}
      </div>
      <div className="prp-panel-footer">
        <button type="button" className="prp-copy-markdown" disabled title="Coming soon">
          Copy as markdown
        </button>
      </div>
    </div>
  )
}
