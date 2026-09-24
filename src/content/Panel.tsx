import { useState } from "react"
import type { CompareUrl } from "../lib/url"
import type { DiffStats } from "../lib/diff"
import { sortFindingsBySeverity, type Finding } from "../lib/checks"
import { CheckRow } from "./CheckRow"
import { EMPTY_DIFF_COPY, RUNNING_CHECKS_COPY, pluralFiles } from "./copy"

export type PanelLoadState = "loading" | "error" | "empty" | "ready"

interface PanelProps {
  compareUrl: CompareUrl | null
  loadState: PanelLoadState
  stats: DiffStats | null
  findings: Finding[] | null
  errorMessage: string | null
  onRetry: () => void
  onCollapse: () => void
}

const SKELETON_ROW_KEYS = ["s0", "s1", "s2", "s3", "s4", "s5"]

export function Panel({ compareUrl, loadState, stats, findings, errorMessage, onRetry, onCollapse }: PanelProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const owner = compareUrl?.owner ?? "unknown"
  const repo = compareUrl?.repo ?? "repo"
  const range = compareUrl?.range ?? "this branch"
  const additions = stats?.additions ?? 0
  const deletions = stats?.deletions ?? 0

  const isLoading = loadState === "loading"
  const isError = loadState === "error"
  const isEmptyDiff = loadState === "empty"
  const isReady = loadState === "ready"
  const sortedFindings = isReady && findings ? sortFindingsBySeverity(findings) : []
  const statsLine = isReady ? `${pluralFiles(stats?.files ?? 0)} +${additions} −${deletions}` : ""

  function toggleRow(id: string): void {
    setExpandedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="prp-panel" role="complementary" aria-label="PR Preflight checklist">
      <div className="prp-panel-header">
        <div className="prp-panel-title">
          <span className="prp-panel-repo">
            {owner}/{repo}
          </span>
          <span className="prp-panel-range">{range}</span>
          {isReady && <span className="prp-panel-stats">{statsLine}</span>}
        </div>
        <button type="button" className="prp-panel-collapse" onClick={onCollapse} aria-label="Collapse panel">
          ×
        </button>
      </div>
      <div className="prp-panel-body">
        {isLoading && (
          <>
            <p className="prp-panel-status" aria-live="polite">
              {RUNNING_CHECKS_COPY}
            </p>
            <ul className="prp-row-list">
              {SKELETON_ROW_KEYS.map((key) => (
                <li key={key} className="prp-row prp-row-skeleton" aria-hidden="true" />
              ))}
            </ul>
          </>
        )}
        {isError && (
          <div className="prp-panel-error">
            <p aria-live="polite">{errorMessage}</p>
            <button type="button" onClick={onRetry}>
              Retry
            </button>
          </div>
        )}
        {isEmptyDiff && (
          <p className="prp-panel-status" aria-live="polite">
            {EMPTY_DIFF_COPY}
          </p>
        )}
        {isReady && (
          <ul className="prp-row-list">
            {sortedFindings.map((finding) => (
              <CheckRow
                key={finding.id}
                id={finding.id}
                level={finding.level}
                title={finding.title}
                items={finding.items}
                expanded={expandedIds.has(finding.id)}
                onToggle={() => toggleRow(finding.id)}
              />
            ))}
          </ul>
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
