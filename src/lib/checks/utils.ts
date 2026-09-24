// parse-diff keeps the unified-diff "+" marker on addedLines[].content; strip it so anchored regexes (e.g. "^\s*print\(") work.
export function stripAddedPrefix(content: string): string {
  return content.startsWith("+") ? content.slice(1) : content
}

export function truncateSnippet(text: string, max = 120): string {
  const trimmed = text.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max)}…`
}

const SOURCE_FILE_PATTERN = /\.(ts|tsx|js|jsx|mjs|py|go|rb|rs|java|kt|swift|php|cs)$/

// Plan's "/tests?/" shorthand assumes a separator on both sides; anchor the left side too or a top-level tests/ dir won't match.
const TEST_FILE_PATTERNS = [
  /\.(test|spec)\.[a-z]+$/,
  /(^|\/)__tests__\//,
  /(^|\/)tests?\//,
  /_test\.go$/,
  /(^|\/)test_[^/]+\.py$/,
  /Spec\.[a-z]+$/
]

export function isSourceFile(path: string): boolean {
  return SOURCE_FILE_PATTERN.test(path)
}

export function isTestFile(path: string): boolean {
  return TEST_FILE_PATTERNS.some((pattern) => pattern.test(path))
}

export function basename(path: string): string {
  return path.split("/").pop() || path
}
