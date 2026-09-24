import { describe, expect, it } from "vitest"
import { parseDiff } from "../../diff"
import { checkTodoMarkers } from "../todoMarkers"

const WITH_TODO = `diff --git a/src/a.ts b/src/a.ts
new file mode 100644
index 0000000..1111111
--- /dev/null
+++ b/src/a.ts
@@ -0,0 +1,2 @@
+export const a = 1
+// TODO: fix this later
`

const WITHOUT_TODO = `diff --git a/src/a.ts b/src/a.ts
new file mode 100644
index 0000000..1111111
--- /dev/null
+++ b/src/a.ts
@@ -0,0 +1,2 @@
+export const a = 1
+export const b = 2
`

const WITH_TODO_AND_SECRET = `diff --git a/src/a.ts b/src/a.ts
new file mode 100644
index 0000000..1111111
--- /dev/null
+++ b/src/a.ts
@@ -0,0 +1,1 @@
+// TODO: rotate this AKIAIOSFODNN7EXAMPLE key
`

describe("checkTodoMarkers", () => {
  it("warns and lists path:line when a TODO/FIXME marker is added", () => {
    const finding = checkTodoMarkers(parseDiff(WITH_TODO))
    expect(finding.level).toBe("warn")
    expect(finding.items).toEqual([{ path: "src/a.ts", line: 2, snippet: "// TODO: fix this later" }])
  })

  it("passes when no added line has a TODO/FIXME/XXX/HACK marker", () => {
    const finding = checkTodoMarkers(parseDiff(WITHOUT_TODO))
    expect(finding.level).toBe("pass")
    expect(finding.items).toEqual([])
  })

  it("redacts a secret pattern caught inside a TODO snippet instead of leaking the raw value", () => {
    const finding = checkTodoMarkers(parseDiff(WITH_TODO_AND_SECRET))
    expect(finding.items[0].snippet).toBe("// TODO: rotate this [redacted AWS access key pattern] key")
  })
})
