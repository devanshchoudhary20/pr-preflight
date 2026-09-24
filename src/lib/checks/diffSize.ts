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
