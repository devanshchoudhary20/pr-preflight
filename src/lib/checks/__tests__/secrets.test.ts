import { describe, expect, it } from "vitest"
import { parseDiff } from "../../diff"
import { checkSecrets } from "../secrets"

const WITH_SECRET = `diff --git a/src/config.ts b/src/config.ts
new file mode 100644
index 0000000..1111111
--- /dev/null
+++ b/src/config.ts
@@ -0,0 +1,1 @@
+const key = "AKIAABCDEFGHIJKLMNOP"
`

const WITH_ENV_FILE = `diff --git a/.env b/.env
new file mode 100644
index 0000000..1111111
--- /dev/null
+++ b/.env
@@ -0,0 +1,1 @@
+SECRET=shh
`

const CLEAN = `diff --git a/src/config.ts b/src/config.ts
new file mode 100644
index 0000000..1111111
--- /dev/null
+++ b/src/config.ts
@@ -0,0 +1,1 @@
+export const greeting = "hello"
`

describe("checkSecrets", () => {
  it("flags a matched secret pattern by name, never the matched text", () => {
    const finding = checkSecrets(parseDiff(WITH_SECRET))
    expect(finding.level).toBe("flag")
    expect(finding.items).toEqual([{ path: "src/config.ts", line: 1, snippet: "AWS access key pattern" }])
  })

  it("flags a committed .env file", () => {
    const finding = checkSecrets(parseDiff(WITH_ENV_FILE))
    expect(finding.level).toBe("flag")
    expect(finding.items.some((item) => item.path === ".env")).toBe(true)
  })

  it("passes when no line matches a secret pattern and no .env file changed", () => {
    const finding = checkSecrets(parseDiff(CLEAN))
    expect(finding.level).toBe("pass")
    expect(finding.items).toEqual([])
  })
})
