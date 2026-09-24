import type { CheckConfig, CheckId, DiffSizeThresholds } from "./checks/types"
import { DEFAULT_CONFIG } from "./checks/types"

const STORAGE_KEY = "config"

export interface PartialCheckConfig {
  diffSize?: Partial<DiffSizeThresholds>
  ignoreGlobs?: string[]
  enabled?: Partial<Record<CheckId, boolean>>
}

function mergeConfig(raw: PartialCheckConfig | undefined): CheckConfig {
  return {
    diffSize: { ...DEFAULT_CONFIG.diffSize, ...raw?.diffSize },
    ignoreGlobs: raw?.ignoreGlobs ?? DEFAULT_CONFIG.ignoreGlobs,
    enabled: { ...DEFAULT_CONFIG.enabled, ...raw?.enabled }
  }
}

export async function loadConfig(): Promise<CheckConfig> {
  const stored = await chrome.storage.sync.get(STORAGE_KEY)
  return mergeConfig(stored[STORAGE_KEY] as PartialCheckConfig | undefined)
}

export async function saveConfig(partial: PartialCheckConfig): Promise<CheckConfig> {
  const current = await loadConfig()
  const next: CheckConfig = {
    diffSize: { ...current.diffSize, ...partial.diffSize },
    ignoreGlobs: partial.ignoreGlobs ?? current.ignoreGlobs,
    enabled: { ...current.enabled, ...partial.enabled }
  }
  await chrome.storage.sync.set({ [STORAGE_KEY]: next })
  return next
}

// A glob-shaped line is any non-empty, single-token string (no internal
// whitespace); picomatch treats a plain filename as a valid literal glob too.
export function isValidGlobLine(line: string): boolean {
  return line.length > 0 && !/\s/.test(line)
}

export interface ParsedGlobLines {
  valid: string[]
  invalid: string[]
}

export function parseGlobLines(text: string): ParsedGlobLines {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
  const valid: string[] = []
  const invalid: string[] = []
  for (const line of lines) {
    if (isValidGlobLine(line)) valid.push(line)
    else invalid.push(line)
  }
  return { valid, invalid }
}

export function onConfigChange(cb: (config: CheckConfig) => void): () => void {
  function listener(changes: Record<string, chrome.storage.StorageChange>, areaName: string): void {
    if (areaName !== "sync") return
    const change = changes[STORAGE_KEY]
    if (!change) return
    cb(mergeConfig(change.newValue as PartialCheckConfig | undefined))
  }
  chrome.storage.onChanged.addListener(listener)
  return () => chrome.storage.onChanged.removeListener(listener)
}
