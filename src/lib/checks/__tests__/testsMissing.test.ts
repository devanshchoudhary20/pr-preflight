import { describe, expect, it } from "vitest"
import { parseDiff } from "../../diff"
import { checkTestsMissing } from "../testsMissing"

const SOURCE_ONLY = `diff --git a/src/feature.ts b/src/feature.ts
new file mode 100644
index 0000000..1111111
--- /dev/null
+++ b/src/feature.ts
@@ -0,0 +1,1 @@
+export function feature() {}
`

const SOURCE_WITH_TEST = `diff --git a/src/feature.ts b/src/feature.ts
new file mode 100644
index 0000000..1111111
--- /dev/null
+++ b/src/feature.ts
@@ -0,0 +1,1 @@
+export function feature() {}
diff --git a/src/feature.test.ts b/src/feature.test.ts
new file mode 100644
index 0000000..2222222
--- /dev/null
+++ b/src/feature.test.ts
@@ -0,0 +1,1 @@
+test("feature", () => {})
`

const DOCS_ONLY = `diff --git a/README.md b/README.md
new file mode 100644
index 0000000..1111111
--- /dev/null
+++ b/README.md
@@ -0,0 +1,1 @@
+# Docs
`

describe("checkTestsMissing", () => {
  it("warns when a source file changes with no test file in the diff", () => {
    const finding = checkTestsMissing(parseDiff(SOURCE_ONLY))
    expect(finding.level).toBe("warn")
    expect(finding.items).toEqual([{ path: "src/feature.ts" }])
  })

  it("passes with 'Tests included' when a matching test file is also in the diff", () => {
    const finding = checkTestsMissing(parseDiff(SOURCE_WITH_TEST))
    expect(finding.level).toBe("pass")
    expect(finding.title).toBe("Tests included")
  })

  it("passes with 'No source files changed' on a docs-only diff", () => {
    const finding = checkTestsMissing(parseDiff(DOCS_ONLY))
    expect(finding.level).toBe("pass")
    expect(finding.title).toBe("No source files changed")
  })
})
