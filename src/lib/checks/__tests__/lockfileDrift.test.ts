import { describe, expect, it } from "vitest"
import { parseDiff } from "../../diff"
import { checkLockfileDrift } from "../lockfileDrift"

const MANIFEST_WITHOUT_LOCKFILE = `diff --git a/package.json b/package.json
index 2222222..3333333 100644
--- a/package.json
+++ b/package.json
@@ -1,3 +1,5 @@
 {
+  "dependencies": {
+  },
   "name": "demo"
 }
`

const MANIFEST_WITH_LOCKFILE = `diff --git a/package.json b/package.json
index 2222222..3333333 100644
--- a/package.json
+++ b/package.json
@@ -1,3 +1,5 @@
 {
+  "dependencies": {
+  },
   "name": "demo"
 }
diff --git a/package-lock.json b/package-lock.json
index 4444444..5555555 100644
--- a/package-lock.json
+++ b/package-lock.json
@@ -1,2 +1,3 @@
 {
+  "lockfileVersion": 3
 }
`

const LOCKFILE_WITHOUT_MANIFEST = `diff --git a/package-lock.json b/package-lock.json
index 4444444..5555555 100644
--- a/package-lock.json
+++ b/package-lock.json
@@ -1,2 +1,3 @@
 {
+  "lockfileVersion": 3
 }
`

describe("checkLockfileDrift", () => {
  it("warns when a manifest's dependency section changes without a paired lockfile", () => {
    const finding = checkLockfileDrift(parseDiff(MANIFEST_WITHOUT_LOCKFILE))
    expect(finding.level).toBe("warn")
    expect(finding.items).toHaveLength(1)
    expect(finding.items[0].path).toBe("package.json")
  })

  it("passes when the manifest and its paired lockfile change together", () => {
    const finding = checkLockfileDrift(parseDiff(MANIFEST_WITH_LOCKFILE))
    expect(finding.level).toBe("pass")
    expect(finding.items).toEqual([])
  })

  it("passes with a note when a lockfile changes without its manifest", () => {
    const finding = checkLockfileDrift(parseDiff(LOCKFILE_WITHOUT_MANIFEST))
    expect(finding.level).toBe("pass")
    expect(finding.title).toContain("package-lock.json")
  })
})
