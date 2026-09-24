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

// The "dependencies" marker sits in unchanged CONTEXT (the header line), not on the added/removed lines themselves,
// so this only warns once the check scans the whole hunk text instead of addedLines only.
const VERSION_BUMP_INSIDE_EXISTING_BLOCK = `diff --git a/package.json b/package.json
index 2222222..3333333 100644
--- a/package.json
+++ b/package.json
@@ -2,7 +2,7 @@
 {
   "name": "demo",
   "dependencies": {
-    "react": "18.2.0"
+    "react": "18.3.1"
   }
 }
`

// Same shape for go.mod: "require (" is context, the added module line carries no dependency marker on its own.
const GO_MOD_ADD_INSIDE_EXISTING_REQUIRE_BLOCK = `diff --git a/go.mod b/go.mod
index 1111111..2222222 100644
--- a/go.mod
+++ b/go.mod
@@ -3,6 +3,7 @@ module example.com/foo
 require (
 	github.com/pkg/errors v0.9.1
+	github.com/pkg/newthing v1.0.0
 )
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

  it("warns on a dependency version bump inside an existing dependencies block, where the marker is only in context", () => {
    const finding = checkLockfileDrift(parseDiff(VERSION_BUMP_INSIDE_EXISTING_BLOCK))
    expect(finding.level).toBe("warn")
    expect(finding.items).toHaveLength(1)
    expect(finding.items[0].path).toBe("package.json")
  })

  it("warns on a go.mod require-block addition, where 'require (' is only in context", () => {
    const finding = checkLockfileDrift(parseDiff(GO_MOD_ADD_INSIDE_EXISTING_REQUIRE_BLOCK))
    expect(finding.level).toBe("warn")
    expect(finding.items).toHaveLength(1)
    expect(finding.items[0].path).toBe("go.mod")
  })
})
