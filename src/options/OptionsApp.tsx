import { useEffect, useRef, useState, type ChangeEvent } from "react"
import { DEFAULT_CONFIG, type CheckConfig, type CheckId } from "../lib/checks/types"
import { loadConfig, saveConfig, parseGlobLines, parseThresholdInput } from "../lib/settings"
import "./options.css"

const CHECK_ORDER: CheckId[] = ["diff-size", "todo-markers", "secrets", "tests-missing", "debug-leftovers", "lockfile-drift"]

const CHECK_LABELS: Record<CheckId, string> = {
  "diff-size": "Diff size",
  "todo-markers": "TODO / FIXME left in",
  secrets: "Secret patterns",
  "tests-missing": "Source changed, no tests changed",
  "debug-leftovers": "Debug leftovers",
  "lockfile-drift": "Lockfile drift"
}

const SAVE_DEBOUNCE_MS = 300
const SAVED_CONFIRM_MS = 2000

function errorReason(err: unknown): string {
  return err instanceof Error && err.message ? err.message : "unknown error"
}

interface PendingSave {
  run: () => Promise<CheckConfig>
  timer: ReturnType<typeof setTimeout>
}

export function OptionsApp() {
  const [loading, setLoading] = useState(true)
  const [config, setConfig] = useState<CheckConfig>(DEFAULT_CONFIG)
  const [globsText, setGlobsText] = useState(DEFAULT_CONFIG.ignoreGlobs.join("\n"))
  const [invalidGlobLines, setInvalidGlobLines] = useState<string[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [savedField, setSavedField] = useState<string | null>(null)

  const pending = useRef<Record<string, PendingSave>>({})
  const savedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    loadConfig()
      .then((loaded) => {
        if (cancelled) return
        setConfig(loaded)
        setGlobsText(loaded.ignoreGlobs.join("\n"))
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        setErrorMessage(`Couldn't save settings (${errorReason(err)})`)
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  function flashSaved(key: string): void {
    setSavedField(key)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    savedTimer.current = setTimeout(() => setSavedField(null), SAVED_CONFIRM_MS)
  }

  async function commitSave(key: string, run: () => Promise<CheckConfig>): Promise<void> {
    try {
      await run()
      setErrorMessage(null)
      flashSaved(key)
    } catch (err) {
      setErrorMessage(`Couldn't save settings (${errorReason(err)})`)
    }
  }

  function scheduleSave(key: string, run: () => Promise<CheckConfig>): void {
    const existing = pending.current[key]
    if (existing) clearTimeout(existing.timer)
    const timer = setTimeout(() => {
      delete pending.current[key]
      void commitSave(key, run)
    }, SAVE_DEBOUNCE_MS)
    pending.current[key] = { run, timer }
  }

  function flushSave(key: string): void {
    const existing = pending.current[key]
    if (!existing) return
    clearTimeout(existing.timer)
    delete pending.current[key]
    void commitSave(key, existing.run)
  }

  function handleThresholdChange(field: "warnLines" | "flagLines", e: ChangeEvent<HTMLInputElement>): void {
    const parsed = parseThresholdInput(e.target.value)
    if (parsed === null) return
    setConfig((current) => ({ ...current, diffSize: { ...current.diffSize, [field]: parsed } }))
    scheduleSave(field, () => saveConfig({ diffSize: { [field]: parsed } }))
  }

  function handleGlobsChange(e: ChangeEvent<HTMLTextAreaElement>): void {
    const text = e.target.value
    setGlobsText(text)
    const { valid, invalid } = parseGlobLines(text)
    setInvalidGlobLines(invalid)
    scheduleSave("ignoreGlobs", () => saveConfig({ ignoreGlobs: valid }))
  }

  function handleToggle(id: CheckId, value: boolean): void {
    setConfig((current) => ({ ...current, enabled: { ...current.enabled, [id]: value } }))
    void commitSave(id, () => saveConfig({ enabled: { [id]: value } }))
  }

  const warnLines = config.diffSize.warnLines ?? DEFAULT_CONFIG.diffSize.warnLines
  const flagLines = config.diffSize.flagLines ?? DEFAULT_CONFIG.diffSize.flagLines

  return (
    <div className="prp-root prp-options">
      <h1>PR Preflight settings</h1>
      {loading && <p className="prp-options-status">Loading settings…</p>}
      {errorMessage && <div className="prp-options-banner">{errorMessage}</div>}

      <section className="prp-options-section">
        <h2>Diff size thresholds</h2>
        <label className="prp-options-field">
          <span>Warn above this many changed lines</span>
          <input
            type="number"
            min={0}
            value={warnLines}
            disabled={loading}
            onChange={(e) => handleThresholdChange("warnLines", e)}
            onBlur={() => flushSave("warnLines")}
          />
          {savedField === "warnLines" && <span className="prp-options-saved">Saved</span>}
        </label>
        <label className="prp-options-field">
          <span>Flag above this many changed lines</span>
          <input
            type="number"
            min={0}
            value={flagLines}
            disabled={loading}
            onChange={(e) => handleThresholdChange("flagLines", e)}
            onBlur={() => flushSave("flagLines")}
          />
          {savedField === "flagLines" && <span className="prp-options-saved">Saved</span>}
        </label>
      </section>

      <section className="prp-options-section">
        <h2>Ignore globs</h2>
        <textarea
          className="prp-options-globs"
          rows={6}
          value={globsText}
          disabled={loading}
          onChange={handleGlobsChange}
          onBlur={() => flushSave("ignoreGlobs")}
        />
        {savedField === "ignoreGlobs" && <span className="prp-options-saved">Saved</span>}
        {invalidGlobLines.length > 0 && (
          <p className="prp-options-invalid">Not saved, no whitespace allowed: {invalidGlobLines.join(", ")}</p>
        )}
      </section>

      <section className="prp-options-section">
        <h2>Checks</h2>
        {CHECK_ORDER.map((id) => (
          <label key={id} className="prp-options-toggle">
            <input
              type="checkbox"
              checked={config.enabled[id]}
              disabled={loading}
              onChange={(e) => handleToggle(id, e.target.checked)}
            />
            <span>{CHECK_LABELS[id]}</span>
            {savedField === id && <span className="prp-options-saved">Saved</span>}
          </label>
        ))}
      </section>
    </div>
  )
}
