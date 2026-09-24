import { describe, expect, it } from "vitest"
import { parseDiff } from "../../diff"
import { checkDiffSize } from "../diffSize"
import { DEFAULT_CONFIG } from "../types"

function fileDiff(path: string, addedLines: number): string {
  const body = Array.from({ length: addedLines }, (_, i) => `+line ${i}`).join("\n")
  return `diff --git a/${path} b/${path}\nnew file mode 100644\nindex 0000000..1111111\n--- /dev/null\n+++ b/${path}\n@@ -0,0 +1,${addedLines} @@\n${body}\n`
}

describe("checkDiffSize", () => {
  it("warns when changed lines exceed the warn threshold", () => {
    const diff = fileDiff("src/big.ts", 450)
    const finding = checkDiffSize(parseDiff(diff), DEFAULT_CONFIG)
    expect(finding.level).toBe("warn")
    expect(finding.title).toContain("450")
  })

  it("passes on a small diff", () => {
    const diff = fileDiff("src/small.ts", 5)
    const finding = checkDiffSize(parseDiff(diff), DEFAULT_CONFIG)
    expect(finding.level).toBe("pass")
  })
})
