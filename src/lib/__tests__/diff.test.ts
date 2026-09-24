import { describe, expect, it } from "vitest"
import { parseDiff, diffStats } from "../diff"

const FIXTURE = `diff --git a/src/a.ts b/src/a.ts
index 1111111..2222222 100644
--- a/src/a.ts
+++ b/src/a.ts
@@ -1,4 +1,4 @@
 line1
+added line
 line2
-removed line
 line3
diff --git a/README.md b/README.md
index 3333333..4444444 100644
--- a/README.md
+++ b/README.md
@@ -1,2 +1,3 @@
 hello
+world
 bye
`

describe("diffStats", () => {
  it("totals files, additions, and deletions across the parsed diff", () => {
    const files = parseDiff(FIXTURE)
    expect(diffStats(files)).toEqual({ files: 2, additions: 2, deletions: 1 })
  })

  it("collects added lines with their line numbers per file", () => {
    const [first] = parseDiff(FIXTURE)
    expect(first.path).toBe("src/a.ts")
    expect(first.addedLines).toEqual([{ lineNo: 2, content: "+added line" }])
  })

  it("returns zeroed stats for an empty diff", () => {
    expect(diffStats(parseDiff(""))).toEqual({ files: 0, additions: 0, deletions: 0 })
  })
})
