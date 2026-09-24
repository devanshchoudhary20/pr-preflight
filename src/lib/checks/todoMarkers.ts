import type { DiffFile } from "../diff"
import type { Finding, FindingItem } from "./types"
import { stripAddedPrefix, truncateSnippet } from "./utils"
import { plural } from "../../content/copy"

const TODO_PATTERN = /\b(TODO|FIXME|XXX|HACK)\b/

export function checkTodoMarkers(files: DiffFile[]): Finding {
  const items: FindingItem[] = []
  for (const file of files) {
    for (const addedLine of file.addedLines) {
      const content = stripAddedPrefix(addedLine.content)
      if (TODO_PATTERN.test(content)) {
        items.push({ path: file.path, line: addedLine.lineNo, snippet: truncateSnippet(content) })
      }
    }
  }
  const level = items.length > 0 ? "warn" : "pass"
  const title = level === "warn" ? `${plural(items.length, "TODO/FIXME marker")} left in` : "No TODO/FIXME markers left in"
  return { id: "todo-markers", level, title, items }
}
