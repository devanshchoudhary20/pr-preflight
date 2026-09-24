export type FindingLevel = "pass" | "warn" | "flag"

export interface FindingItem {
  path: string
  line?: number
  snippet?: string
}

export interface Finding {
  id: string
  level: FindingLevel
  title: string
  items: FindingItem[]
}

export type CheckId =
  | "diff-size"
  | "todo-markers"
  | "secrets"
  | "tests-missing"
  | "debug-leftovers"
  | "lockfile-drift"

export interface DiffSizeThresholds {
  warnLines: number
  flagLines: number
  warnFiles: number
  flagFiles: number
}

export interface CheckConfig {
  diffSize: DiffSizeThresholds
  ignoreGlobs: string[]
  enabled: Record<CheckId, boolean>
}

export const DEFAULT_IGNORE_GLOBS = [
  "*.lock",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "*.min.*",
  "dist/**",
  "build/**",
  "*.snap",
  "*.map",
  "vendor/**"
]

export const DEFAULT_CONFIG: CheckConfig = {
  diffSize: { warnLines: 400, flagLines: 1000, warnFiles: 20, flagFiles: 50 },
  ignoreGlobs: DEFAULT_IGNORE_GLOBS,
  enabled: {
    "diff-size": true,
    "todo-markers": true,
    secrets: true,
    "tests-missing": true,
    "debug-leftovers": true,
    "lockfile-drift": true
  }
}
