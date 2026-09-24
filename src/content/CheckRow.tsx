import { useState } from "react"
import type { FindingItem, FindingLevel } from "../lib/checks"
import { scrollToFile } from "../lib/selectors"
import { NO_PREVIEW_FALLBACK, UNKNOWN_FILE_FALLBACK } from "./copy"

interface CheckRowProps {
  id: string
  level: FindingLevel
  title: string
  items: FindingItem[]
  expanded: boolean
  onToggle: () => void
}

const LEVEL_LABEL: Record<FindingLevel, string> = { pass: "Pass", warn: "Warn", flag: "Flag" }

function formatPath(path: string): string {
  return path.trim() ? path : UNKNOWN_FILE_FALLBACK
}

function formatLineSuffix(line: number | undefined): string {
  return typeof line === "number" ? `:${line}` : ""
}

function formatSnippet(snippet: string | undefined): string {
  const trimmed = snippet?.trim() ?? ""
  if (!trimmed) return NO_PREVIEW_FALLBACK
  return trimmed.length > 120 ? `${trimmed.slice(0, 120)}…` : trimmed
}

export function CheckRow({ id, level, title, items, expanded, onToggle }: CheckRowProps) {
  const [checked, setChecked] = useState(false)
  const canExpand = items.length > 0
  const rowTitle = title.trim() ? title : "Check"

  return (
    <li className={`prp-row prp-row-${level}`}>
      <div className="prp-row-main">
        <input
          type="checkbox"
          className="prp-row-tick"
          checked={checked}
          onChange={() => setChecked((value) => !value)}
          aria-label={`Mark "${rowTitle}" reviewed`}
        />
        <button
          type="button"
          className="prp-row-toggle"
          onClick={onToggle}
          disabled={!canExpand}
          aria-expanded={expanded}
        >
          <span className={`prp-pill prp-pill-${level}`}>{LEVEL_LABEL[level]}</span>
          <span className="prp-row-title">{rowTitle}</span>
        </button>
      </div>
      {expanded && canExpand && (
        <ul className="prp-row-items" id={`prp-row-items-${id}`}>
          {items.map((item, index) => (
            <li key={`${item.path}-${item.line ?? index}`} className="prp-row-item">
              <button type="button" className="prp-row-item-path" onClick={() => scrollToFile(item.path)}>
                {formatPath(item.path)}
                {formatLineSuffix(item.line)}
              </button>
              <span className="prp-row-item-snippet">{formatSnippet(item.snippet)}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}
