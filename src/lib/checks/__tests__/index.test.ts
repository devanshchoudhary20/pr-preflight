import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { parseDiff } from "../../diff"
import { runChecks, sortFindingsBySeverity, worstLevel } from "../index"
import { DEFAULT_CONFIG } from "../types"

const FIXTURES_DIR = join(__dirname, "..", "__fixtures__")
const PLANTED = readFileSync(join(FIXTURES_DIR, "planted.diff"), "utf8")
const CLEAN = readFileSync(join(FIXTURES_DIR, "clean.diff"), "utf8")
const VITE_REAL_WORLD = readFileSync(join(FIXTURES_DIR, "vite-5.4.10-5.4.11.diff"), "utf8")

const EXPECTED_ORDER = ["diff-size", "todo-markers", "secrets", "tests-missing", "debug-leftovers", "lockfile-drift"]

describe("runChecks", () => {
  it("fires all six checks with a warn/flag on a diff that plants one violation each", () => {
    const findings = runChecks(parseDiff(PLANTED), DEFAULT_CONFIG)
    expect(findings.map((f) => f.id)).toEqual(EXPECTED_ORDER)
    const levels = Object.fromEntries(findings.map((f) => [f.id, f.level]))
    expect(levels).toEqual({
      "diff-size": "warn",
      "todo-markers": "warn",
      secrets: "flag",
      "tests-missing": "warn",
      "debug-leftovers": "warn",
      "lockfile-drift": "warn"
    })
  })

  it("passes all six checks on a docs-only, clean diff", () => {
    const findings = runChecks(parseDiff(CLEAN), DEFAULT_CONFIG)
    expect(findings).toHaveLength(6)
    expect(findings.every((f) => f.level === "pass")).toBe(true)
  })

  it("keeps a fixed check order regardless of severity", () => {
    const findings = runChecks(parseDiff(PLANTED), DEFAULT_CONFIG)
    expect(findings.map((f) => f.id)).toEqual(EXPECTED_ORDER)
  })

  it("runs cleanly end-to-end against a real vitejs/vite compare diff", () => {
    const findings = runChecks(parseDiff(VITE_REAL_WORLD), DEFAULT_CONFIG)
    expect(findings.map((f) => f.id)).toEqual(EXPECTED_ORDER)
    expect(findings.every((f) => ["pass", "warn", "flag"].includes(f.level))).toBe(true)
  })

  it("excludes ignored files (e.g. package-lock.json) from the non-lockfile checks", () => {
    const diff = `diff --git a/package-lock.json b/package-lock.json
new file mode 100644
index 0000000..1111111
--- /dev/null
+++ b/package-lock.json
@@ -0,0 +1,1 @@
+// TODO leftover inside a generated lockfile
`
    const findings = runChecks(parseDiff(diff), DEFAULT_CONFIG)
    const todo = findings.find((f) => f.id === "todo-markers")
    expect(todo?.level).toBe("pass")
  })

  function todoDiffAt(path: string): string {
    return `diff --git a/${path} b/${path}
new file mode 100644
index 0000000..1111111
--- /dev/null
+++ b/${path}
@@ -0,0 +1,1 @@
+// TODO leftover
`
  }

  it("ignores a slash-less glob at any depth (packages/a/yarn.lock via *.lock)", () => {
    const findings = runChecks(parseDiff(todoDiffAt("packages/a/yarn.lock")), DEFAULT_CONFIG)
    expect(findings.find((f) => f.id === "todo-markers")?.level).toBe("pass")
  })

  it("ignores a slash-less glob at any depth (src/x.js.map via *.map)", () => {
    const findings = runChecks(parseDiff(todoDiffAt("src/x.js.map")), DEFAULT_CONFIG)
    expect(findings.find((f) => f.id === "todo-markers")?.level).toBe("pass")
  })

  it("ignores a slash-less glob at any depth (a/b/foo.min.js via *.min.*)", () => {
    const findings = runChecks(parseDiff(todoDiffAt("a/b/foo.min.js")), DEFAULT_CONFIG)
    expect(findings.find((f) => f.id === "todo-markers")?.level).toBe("pass")
  })

  it("keeps a slash-containing glob path-anchored: dist/** matches dist/x.js but not src/dist/x.js", () => {
    const matched = runChecks(parseDiff(todoDiffAt("dist/x.js")), DEFAULT_CONFIG)
    expect(matched.find((f) => f.id === "todo-markers")?.level).toBe("pass")

    const notMatched = runChecks(parseDiff(todoDiffAt("src/dist/x.js")), DEFAULT_CONFIG)
    expect(notMatched.find((f) => f.id === "todo-markers")?.level).toBe("warn")
  })
})

describe("sortFindingsBySeverity", () => {
  it("orders flag, then warn, then pass", () => {
    const findings = runChecks(parseDiff(PLANTED), DEFAULT_CONFIG)
    const sorted = sortFindingsBySeverity(findings)
    expect(sorted.map((f) => f.level)).toEqual(["flag", "warn", "warn", "warn", "warn", "warn"])
  })
})

describe("worstLevel", () => {
  it("returns flag when any finding flags", () => {
    expect(worstLevel(runChecks(parseDiff(PLANTED), DEFAULT_CONFIG))).toBe("flag")
  })

  it("returns null when every finding passes", () => {
    expect(worstLevel(runChecks(parseDiff(CLEAN), DEFAULT_CONFIG))).toBeNull()
  })
})
