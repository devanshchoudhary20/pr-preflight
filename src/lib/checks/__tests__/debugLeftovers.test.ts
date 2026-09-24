import { describe, expect, it } from "vitest"
import { parseDiff } from "../../diff"
import { checkDebugLeftovers } from "../debugLeftovers"

const WITH_CONSOLE_LOG = `diff --git a/src/a.ts b/src/a.ts
new file mode 100644
index 0000000..1111111
--- /dev/null
+++ b/src/a.ts
@@ -0,0 +1,1 @@
+console.log("debug me")
`

const WITH_PYTHON_PRINT = `diff --git a/app.py b/app.py
new file mode 100644
index 0000000..1111111
--- /dev/null
+++ b/app.py
@@ -0,0 +1,1 @@
+print("debug")
`

const SKIPPED_IN_TEST_FILE = `diff --git a/src/a.test.ts b/src/a.test.ts
new file mode 100644
index 0000000..1111111
--- /dev/null
+++ b/src/a.test.ts
@@ -0,0 +1,1 @@
+console.log("expected in a test assertion")
`

const CLEAN = `diff --git a/src/a.ts b/src/a.ts
new file mode 100644
index 0000000..1111111
--- /dev/null
+++ b/src/a.ts
@@ -0,0 +1,1 @@
+export const a = 1
`

describe("checkDebugLeftovers", () => {
  it("warns on a console.log left in an added line", () => {
    const finding = checkDebugLeftovers(parseDiff(WITH_CONSOLE_LOG))
    expect(finding.level).toBe("warn")
    expect(finding.items).toEqual([{ path: "src/a.ts", line: 1, snippet: 'console.log("debug me")' }])
  })

  it("warns on a bare print( in a .py file", () => {
    const finding = checkDebugLeftovers(parseDiff(WITH_PYTHON_PRINT))
    expect(finding.level).toBe("warn")
  })

  it("skips matches inside test files", () => {
    const finding = checkDebugLeftovers(parseDiff(SKIPPED_IN_TEST_FILE))
    expect(finding.level).toBe("pass")
  })

  it("passes when no debug pattern is added", () => {
    const finding = checkDebugLeftovers(parseDiff(CLEAN))
    expect(finding.level).toBe("pass")
    expect(finding.items).toEqual([])
  })
})
