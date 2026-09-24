import type { DiffFile } from "../diff"
import type { CheckConfig, Finding } from "./types"

export function checkDiffSize(files: DiffFile[], config: CheckConfig): Finding {
  const changedLines = files.reduce((sum, file) => sum + (file.additions ?? 0) + (file.deletions ?? 0), 0)
  const fileCount = files.length
  const { warnLines, flagLines, warnFiles, flagFiles } = config.diffSize

  const isFlag = changedLines > flagLines || fileCount > flagFiles
  const isWarn = !isFlag && (changedLines > warnLines || fileCount > warnFiles)
  const level = isFlag ? "flag" : isWarn ? "warn" : "pass"

  const fileWord = `${fileCount} file${fileCount === 1 ? "" : "s"}`
  const title =
    level === "pass"
      ? `Diff size is reasonable (${fileWord}, ${changedLines} changed lines)`
      : `${fileWord} changed, ${changedLines} changed lines`

  return { id: "diff-size", level, title, items: [] }
}

// Synthetic finding shown as the only row when fetchDiff aborts past the 2 MB
// cap; sizeMb is already resolved to a display string (real MB or "over 2").
export function diffTooLargeFinding(sizeMb: string): Finding {
  return {
    id: "diff-size",
    level: "flag",
    title: `This diff is too large to check in the browser (${sizeMb} MB, cap is 2 MB). Showing size only.`,
    items: []
  }
}
