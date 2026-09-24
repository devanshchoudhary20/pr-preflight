import picomatch from "picomatch"
import type { DiffFile } from "../diff"
import type { CheckConfig, Finding, FindingLevel } from "./types"
import { DEFAULT_CONFIG } from "./types"
import { basename } from "./utils"
import { checkDiffSize } from "./diffSize"
import { checkTodoMarkers } from "./todoMarkers"
import { checkSecrets } from "./secrets"
import { checkTestsMissing } from "./testsMissing"
import { checkDebugLeftovers } from "./debugLeftovers"
import { checkLockfileDrift, LOCKFILE_NAMES } from "./lockfileDrift"

// picomatch's basename:true forces EVERY pattern (including "dist/**") to test against just the path's basename,
// which breaks path-anchored globstars (see node_modules/picomatch/lib/picomatch.js:148). So basename mode is opted
// into per-glob: a slash-less glob (e.g. "*.lock") matches at any depth, a slash-containing glob stays path-anchored.
function isIgnored(path: string, globs: string[]): boolean {
  return globs.some((glob) => picomatch.isMatch(path, glob, glob.includes("/") ? { dot: true } : { dot: true, basename: true }))
}

export function runChecks(files: DiffFile[], config: CheckConfig = DEFAULT_CONFIG): Finding[] {
  const kept = files.filter((file) => !isIgnored(file.path, config.ignoreGlobs))
  // Lockfiles are exempt from the ignore list for check 6 only, so add back any ignored lockfile-named files onto "kept".
  const lockfileScope = [...kept, ...files.filter((file) => !kept.includes(file) && LOCKFILE_NAMES.has(basename(file.path)))]

  const findings: Finding[] = []
  if (config.enabled["diff-size"]) findings.push(checkDiffSize(kept, config))
  if (config.enabled["todo-markers"]) findings.push(checkTodoMarkers(kept))
  if (config.enabled.secrets) findings.push(checkSecrets(kept))
  if (config.enabled["tests-missing"]) findings.push(checkTestsMissing(kept))
  if (config.enabled["debug-leftovers"]) findings.push(checkDebugLeftovers(kept))
  if (config.enabled["lockfile-drift"]) findings.push(checkLockfileDrift(lockfileScope))
  return findings
}

const LEVEL_PRIORITY: Record<FindingLevel, number> = { flag: 0, warn: 1, pass: 2 }

export function sortFindingsBySeverity(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => LEVEL_PRIORITY[a.level] - LEVEL_PRIORITY[b.level])
}

// null means every finding passed; used by the badge and popup to pick the "all clear" vs "{n} to review" copy.
export function worstLevel(findings: Finding[]): FindingLevel | null {
  if (findings.some((f) => f.level === "flag")) return "flag"
  if (findings.some((f) => f.level === "warn")) return "warn"
  return null
}

export * from "./types"
