import { useEffect, useRef, useState } from "react"
import type { CompareUrl } from "../lib/url"
import type { DiffStats } from "../lib/diff"
import { sortFindingsBySeverity, type Finding } from "../lib/checks"
import { loadTicks, setTick } from "../lib/ticks"
import { formatFindingsAsMarkdown } from "./markdown"
import { selectors } from "../lib/selectors"
import { CheckRow } from "./CheckRow"
import { EMPTY_DIFF_COPY, FETCHING_DIFF_COPY, pluralFiles } from "./copy"

export type PanelLoadState = "loading" | "error" | "empty" | "ready"

interface PanelProps {
  compareUrl: CompareUrl | null
  loadState: PanelLoadState
  stats: DiffStats | null
  findings: Finding[] | null
  errorMessage: string | null
  errorHeading?: string | null
  onRetry: () => void
  onCollapse: () => void
}

const SKELETON_ROW_KEYS = ["s0", "s1", "s2", "s3", "s4", "s5"]
const COPY_CONFIRM_MS = 2000

export function Panel({ compareUrl, loadState, stats, findings, errorMessage, errorHeading, onRetry, onCollapse }: PanelProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle")
  const panelRef = useRef<HTMLDivElement>(null)
  // Read once at mount: the compare/PR form DOM is already present by document_idle, and this id is UNVERIFIED so it degrades to false silently.
  const [bodyFieldExists] = useState(() => !!document.querySelector(selectors.pullRequestBody))

  const owner = compareUrl?.owner ?? "unknown"
  const repo = compareUrl?.repo ?? "repo"
  const range = compareUrl?.range ?? "this branch"

  const isLoading = loadState === "loading"
  const isError = loadState === "error"
  const isEmptyDiff = loadState === "empty"
  const isReady = loadState === "ready"
  const sortedFindings = isReady && findings ? sortFindingsBySeverity(findings) : []
  // stats can be null on the DOM-fallback-failed path even while loadState is "ready" (synthetic diff-too-large finding); omit the line entirely rather than show 0s.
  const showStats = isReady && stats !== null
  const statsLine = showStats ? `${pluralFiles(stats.files)} +${stats.additions} −${stats.deletions}` : ""
  const copyButtonLabel = copyState === "copied" ? "Copied" : copyState === "failed" ? "Copy failed" : "Copy as markdown"

  useEffect(() => {
    if (!compareUrl) return
    let cancelled = false
    loadTicks(compareUrl.owner, compareUrl.repo, compareUrl.range).then((ids) => {
      if (!cancelled) setCheckedIds(ids)
    })
    return () => {
      cancelled = true
    }
  }, [compareUrl])

  function toggleRow(id: string): void {
    setExpandedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleTick(id: string): void {
    if (!compareUrl) return
    setCheckedIds((current) => {
      const next = new Set(current)
      const nextChecked = !next.has(id)
      if (nextChecked) next.add(id)
      else next.delete(id)
      void setTick(compareUrl.owner, compareUrl.repo, compareUrl.range, id, nextChecked)
      return next
    })
  }

  // execCommand fallback for when clipboard.writeText rejects (unfocused doc, or outside a fresh user-gesture task); textarea mounts in the same root (shadow or document) as the trigger so it stays reachable for selection.
  function copyViaFallback(markdown: string): boolean {
    const textarea = document.createElement("textarea")
    textarea.value = markdown
    textarea.style.position = "fixed"
    textarea.style.opacity = "0"
    const root = panelRef.current?.getRootNode()
    const mountPoint = root instanceof ShadowRoot ? root : document.body
    mountPoint.appendChild(textarea)
    textarea.focus()
    textarea.select()
    let succeeded = false
    try {
      succeeded = document.execCommand("copy")
    } catch {
      succeeded = false
    }
    textarea.remove()
    return succeeded
  }

  function showCopyResult(state: "copied" | "failed"): void {
    setCopyState(state)
    setTimeout(() => setCopyState("idle"), COPY_CONFIRM_MS)
  }

  function handleCopy(): void {
    const markdown = formatFindingsAsMarkdown(sortedFindings, checkedIds)
    // No await before writeText: keeps the call inside the click's user-gesture task.
    const copyPromise = navigator.clipboard?.writeText(markdown) ?? Promise.reject(new Error("clipboard unavailable"))
    copyPromise.then(
      () => showCopyResult("copied"),
      () => showCopyResult(copyViaFallback(markdown) ? "copied" : "failed")
    )
  }

  function handleInsert(): void {
    const field = document.querySelector<HTMLTextAreaElement>(selectors.pullRequestBody)
    if (!field) return
    const markdown = formatFindingsAsMarkdown(sortedFindings, checkedIds)
    field.value = field.value ? `${field.value}\n\n${markdown}` : markdown
    field.dispatchEvent(new Event("input", { bubbles: true }))
  }

  return (
    <div className="prp-panel" role="complementary" aria-label="PR Preflight checklist" ref={panelRef}>
      <div className="prp-panel-header">
        <div className="prp-panel-title">
          <span className="prp-panel-repo">
            {owner}/{repo}
          </span>
          <span className="prp-panel-range">{range}</span>
          {showStats && <span className="prp-panel-stats">{statsLine}</span>}
        </div>
        <button type="button" className="prp-panel-collapse" onClick={onCollapse} aria-label="Collapse panel">
          ×
        </button>
      </div>
      <div className="prp-panel-body">
        {isLoading && (
          <>
            <p className="prp-panel-status" aria-live="polite">
              {FETCHING_DIFF_COPY}
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
            {errorHeading && <p className="prp-panel-error-heading">{errorHeading}</p>}
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
                checked={checkedIds.has(finding.id)}
                onToggle={() => toggleRow(finding.id)}
                onToggleTick={() => toggleTick(finding.id)}
              />
            ))}
          </ul>
        )}
      </div>
      <div className="prp-panel-footer">
        <div className="prp-panel-footer-actions">
          <button type="button" className="prp-copy-markdown" onClick={handleCopy} disabled={!isReady}>
            {copyButtonLabel}
          </button>
          {bodyFieldExists && (
            <button type="button" className="prp-insert-description" onClick={handleInsert} disabled={!isReady}>
              Insert into description
            </button>
          )}
        </div>
        <p className="prp-panel-footer-note">Ticks saved for 7 days</p>
      </div>
    </div>
  )
}
