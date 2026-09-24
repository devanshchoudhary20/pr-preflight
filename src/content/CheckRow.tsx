import type { FindingItem, FindingLevel } from "../lib/checks"
import { formatItem } from "../lib/checks/format"
import { scrollToFile } from "../lib/selectors"
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

export function CheckRow({ id, level, title, items, expanded, checked, onToggle, onToggleTick }: CheckRowProps) {
  const canExpand = items.length > 0
  const rowTitle = title.trim() ? title : "Check"
  const itemsId = `prp-row-items-${id}`
  const displayItems = items.map((item, index) => {
    const { label, snippet } = formatItem(item)
    return { key: `${item.path}-${item.line ?? index}`, path: item.path, label, snippet: snippet || NO_PREVIEW_FALLBACK }
  })

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
          <span className={`prp-pill prp-pill-${level}`}>{LEVEL_LABEL[level]}</span>
          <span className="prp-row-title">{rowTitle}</span>
        </button>
      </div>
      {expanded && canExpand && (
        <ul className="prp-row-items" id={itemsId}>
          {displayItems.map((item) => (
            <li key={item.key} className="prp-row-item">
              <button type="button" className="prp-row-item-path" onClick={() => scrollToFile(item.path)}>
                {item.label}
              </button>
              <span className="prp-row-item-snippet">{item.snippet}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}
