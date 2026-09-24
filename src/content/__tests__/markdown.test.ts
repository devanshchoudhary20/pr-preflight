import { describe, expect, it } from "vitest"
import { formatFindingsAsMarkdown } from "../markdown"
import type { Finding } from "../../lib/checks/types"

describe("formatFindingsAsMarkdown", () => {
  it("renders a GitHub task list with path:line sub-bullets and the footer line, using tick state for the checkbox", () => {
    const findings: Finding[] = [
      {
        id: "todo-markers",
        level: "warn",
        title: "1 TODO/FIXME marker left in",
        items: [{ path: "src/a.ts", line: 4, snippet: "// TODO fix" }]
      },
      { id: "secrets", level: "pass", title: "No secret patterns found", items: [] }
    ]

    const markdown = formatFindingsAsMarkdown(findings, new Set(["secrets"]))

    expect(markdown).toBe(
      ["- [ ] 1 TODO/FIXME marker left in", "  - src/a.ts:4 — // TODO fix", "- [x] No secret patterns found", "_via PR Preflight_"].join(
        "\n"
      )
    )
  })
})
