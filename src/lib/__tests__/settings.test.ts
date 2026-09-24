import { beforeEach, describe, expect, it } from "vitest"
import { installChromeStorageStub } from "./chromeStorageStub"
import { loadConfig, saveConfig, parseGlobLines, parseThresholdInput } from "../settings"
import { DEFAULT_CONFIG } from "../checks/types"

beforeEach(() => {
  installChromeStorageStub()
})

describe("loadConfig", () => {
  it("falls back to DEFAULT_CONFIG when nothing is stored yet", async () => {
    expect(await loadConfig()).toEqual(DEFAULT_CONFIG)
  })

  it("merges a partial stored config with defaults field by field", async () => {
    await saveConfig({ diffSize: { warnLines: 200 }, enabled: { secrets: false } })
    const config = await loadConfig()
    expect(config.diffSize.warnLines).toBe(200)
    expect(config.diffSize.flagLines).toBe(DEFAULT_CONFIG.diffSize.flagLines)
    expect(config.enabled.secrets).toBe(false)
    expect(config.enabled["todo-markers"]).toBe(DEFAULT_CONFIG.enabled["todo-markers"])
    expect(config.ignoreGlobs).toEqual(DEFAULT_CONFIG.ignoreGlobs)
  })
})

describe("parseGlobLines", () => {
  it("accepts non-empty, whitespace-free lines and flags the rest as invalid", () => {
    const { valid, invalid } = parseGlobLines("dist/**\nnot a glob\n\n*.snap\n")
    expect(valid).toEqual(["dist/**", "*.snap"])
    expect(invalid).toEqual(["not a glob"])
  })
})

describe("parseThresholdInput", () => {
  it("rejects empty, non-finite, and negative input, and accepts a valid non-negative number", () => {
    expect(parseThresholdInput("")).toBeNull()
    expect(parseThresholdInput("not a number")).toBeNull()
    expect(parseThresholdInput("-5")).toBeNull()
    expect(parseThresholdInput("400")).toBe(400)
    expect(parseThresholdInput("0")).toBe(0)
  })
})
