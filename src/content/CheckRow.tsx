import { useState } from "react"
import type { FindingItem, FindingLevel } from "../lib/checks"
import { formatItem } from "../lib/checks/format"
import { existingFilePaths, scrollToFile } from "../lib/selectors"
import { NO_PREVIEW_FALLBACK } from "./copy"

interface CheckRowProps {
  id: string
  level: FindingLevel
  title: string
  items: FindingItem[]
  expanded: boolean
  checked: boolean
  onToggle: () => void
  onToggleTick: () => void
}

const LEVEL_LABEL: Record<FindingLevel, string> = { pass: "Pass", warn: "Warn", flag: "Flag" }
const COMPACT_VISIBLE_COUNT = 5

export function CheckRow({ id, level, title, items, expanded, checked, onToggle, onToggleTick }: CheckRowProps) {
  const [showAllCompact, setShowAllCompact] = useState(false)
  // Read once per row mount: the underlying file list doesn't change while this row stays expanded.
  const [linkablePaths] = useState(() => existingFilePaths())

  const canExpand = items.length > 0
  const rowTitle = title.trim() ? title : "Check"
  const itemsId = `prp-row-items-${id}`
  const formattedItems = items.map((item, index) => {
    const { label, snippet } = formatItem(item)
    return { key: `${item.path}-${item.line ?? index}`, path: item.path, label, snippet }
  })
  // A check whose items never carry a snippet (e.g. tests-missing' bare file list) renders compact, no "(no preview)" filler line.
  const isCompact = formattedItems.length > 0 && formattedItems.every((item) => !item.snippet)
  const visibleItems = isCompact && !showAllCompact ? formattedItems.slice(0, COMPACT_VISIBLE_COUNT) : formattedItems
  const hiddenCount = isCompact ? formattedItems.length - visibleItems.length : 0

  return (
    <li className={`prp-row prp-row-${level}`}>
      <div className="prp-row-main">
        <input
          type="checkbox"
          className="prp-row-tick"
          checked={checked}
          onChange={onToggleTick}
          aria-label={`Mark "${rowTitle}" reviewed`}
        />
        <button type="button" className="prp-row-toggle" onClick={onToggle} disabled={!canExpand} aria-expanded={expanded} aria-controls={itemsId}>
          <span className="prp-row-title">{rowTitle}</span>
          <span className={`prp-pill prp-pill-${level}`}>{LEVEL_LABEL[level]}</span>
        </button>
      </div>
      {expanded && canExpand && (
        <ul className={`prp-row-items${isCompact ? " prp-row-items-compact" : ""}`} id={itemsId}>
          {visibleItems.map((item) => (
            <li key={item.key} className="prp-row-item">
              {linkablePaths.has(item.path) ? (
                <button type="button" className="prp-row-item-path prp-row-item-path-link" onClick={() => scrollToFile(item.path)}>
                  {item.label}
                </button>
              ) : (
                <span className="prp-row-item-path">{item.label}</span>
              )}
              {!isCompact && <span className="prp-row-item-snippet">{item.snippet || NO_PREVIEW_FALLBACK}</span>}
            </li>
          ))}
          {hiddenCount > 0 && (
            <li className="prp-row-item-more">
              <button type="button" className="prp-row-item-more-toggle" onClick={() => setShowAllCompact(true)}>
                Show {hiddenCount} more
              </button>
            </li>
          )}
        </ul>
      )}
    </li>
  )
}
