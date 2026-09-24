import type { DiffFile } from "../diff"
import type { Finding, FindingItem } from "./types"
import { basename, stripAddedPrefix } from "./utils"
import { plural } from "../../content/copy"

// snippet is the pattern NAME, never the matched text, so a screenshot of the panel is safe to post publicly.
const SECRET_PATTERNS: { name: string; pattern: RegExp }[] = [
  { name: "AWS access key pattern", pattern: /AKIA[0-9A-Z]{16}/ },
  { name: "GitHub token pattern", pattern: /gh[pousr]_[A-Za-z0-9]{36,}/ },
  { name: "Slack token pattern", pattern: /xox[baprs]-[A-Za-z0-9-]{10,}/ },
  { name: "Anthropic API key pattern", pattern: /sk-ant-[A-Za-z0-9_-]{20,}/ },
  { name: "Stripe live key pattern", pattern: /sk_live_[A-Za-z0-9]{16,}/ },
  { name: "Generic API key pattern", pattern: /sk-[A-Za-z0-9]{32,}/ },
  { name: "Private key block", pattern: /-----BEGIN (RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/ },
  { name: "JWT-like token pattern", pattern: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}/ },
  {
    name: "Hardcoded credential pattern",
    pattern: /(api[_-]?key|secret|password|passwd|token)\s*[:=]\s*['"][^'"]{8,}['"]/i
  }
]

function matchEnvFile(path: string): boolean {
  const name = basename(path)
  if (name === ".env.example") return false
  return /^\.env(\.[^/]+)?$/.test(name)
}

export function checkSecrets(files: DiffFile[]): Finding {
  const items: FindingItem[] = []
  for (const file of files) {
    for (const addedLine of file.addedLines) {
      const content = stripAddedPrefix(addedLine.content)
      const hit = SECRET_PATTERNS.find(({ pattern }) => pattern.test(content))
      if (hit) items.push({ path: file.path, line: addedLine.lineNo, snippet: hit.name })
    }
    if (matchEnvFile(file.path)) {
      items.push({ path: file.path, snippet: "Committed .env file" })
    }
  }
  const level = items.length > 0 ? "flag" : "pass"
  const title = level === "flag" ? `${plural(items.length, "potential secret")} found` : "No secret patterns found"
  return { id: "secrets", level, title, items }
}
