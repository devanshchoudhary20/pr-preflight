import type { DiffFile } from "../diff"
import type { Finding } from "./types"
import { isSourceFile, isTestFile } from "./utils"
import { plural } from "../text"

export function checkTestsMissing(files: DiffFile[]): Finding {
  const sourceFiles = files.filter((file) => isSourceFile(file.path) && !isTestFile(file.path))
  const testFiles = files.filter((file) => isTestFile(file.path))

  if (sourceFiles.length === 0) {
    return { id: "tests-missing", level: "pass", title: "No source files changed", items: [] }
  }
  if (testFiles.length > 0) {
    return { id: "tests-missing", level: "pass", title: "Tests included", items: [] }
  }
  return {
    id: "tests-missing",
    level: "warn",
    title: `${plural(sourceFiles.length, "source file")} changed, no tests changed`,
    items: sourceFiles.map((file) => ({ path: file.path }))
  }
}
