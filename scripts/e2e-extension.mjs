import { chromium } from "playwright"
import { createHash } from "node:crypto"
import { mkdtemp, mkdir } from "node:fs/promises"
import { tmpdir } from "node:os"
import { resolve, dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const distDir = resolve(root, "dist")
const evidenceDir = resolve(root, ".anbu/evidence")
const FIXTURE_URL = "https://github.com/devanshchoudhary20/prp-fixture/compare/main...feat/planted"

// Chromium's deterministic ID for an unpacked extension: SHA256(abs path), first 16 bytes, hex-to-a..p mapped.
function computeExtensionId(extPath) {
  const abs = resolve(extPath)
  const hash = createHash("sha256").update(abs).digest()
  const truncated = hash.subarray(0, 16)
  let id = ""
  for (const byte of truncated) {
    const hi = byte >> 4
    const lo = byte & 0xf
    id += String.fromCharCode(97 + hi) + String.fromCharCode(97 + lo)
  }
  return id
}

function trackConsole(page, bucket) {
  page.on("console", (msg) => {
    if (msg.type() === "error") bucket.push(`[console:${page.url()}] ${msg.text()}`)
  })
  page.on("pageerror", (err) => {
    bucket.push(`[pageerror:${page.url()}] ${err.message}`)
  })
}

async function waitForExtensionReady(context, extId, attempts = 10) {
  for (let i = 0; i < attempts; i++) {
    const probe = await context.newPage()
    try {
      const resp = await probe.goto(`chrome-extension://${extId}/manifest.json`, { timeout: 3000 }).catch(() => null)
      if (resp && resp.ok()) {
        await probe.close()
        return true
      }
    } catch {
      // retry
    }
    await probe.close()
    await new Promise((r) => setTimeout(r, 500))
  }
  return false
}

async function main() {
  await mkdir(evidenceDir, { recursive: true })
  const extId = computeExtensionId(distDir)
  console.log(`Computed extension id: ${extId}`)

  const userDataDir = await mkdtemp(join(tmpdir(), "prp-e2e-"))
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [`--disable-extensions-except=${distDir}`, `--load-extension=${distDir}`]
  })

  const ready = await waitForExtensionReady(context, extId)
  if (!ready) {
    console.error("Extension never became reachable at the computed id. Aborting.")
    await context.close()
    process.exit(1)
  }
  console.log("Extension reachable, proceeding.")

  const optionsErrors = []
  const popupErrors = []
  const result = {
    options: { defaults: false, liveRerun: false, clearNotSaved: false, secretsOff: false, restored: false, consoleErrors: optionsErrors },
    popup: { renders: false, consoleErrors: popupErrors }
  }

  // --- Screen 3: Options page ---
  const optionsPage = await context.newPage()
  trackConsole(optionsPage, optionsErrors)
  await optionsPage.goto(`chrome-extension://${extId}/options.html`)
  await optionsPage.waitForSelector(".prp-options-field")
  await optionsPage.waitForFunction(() => !document.body.textContent.includes("Loading settings"))

  const warnInput = optionsPage.locator('input[type="number"]').nth(0)
  const flagInput = optionsPage.locator('input[type="number"]').nth(1)
  const globsTextarea = optionsPage.locator("textarea.prp-options-globs")
  const checkToggles = optionsPage.locator(".prp-options-toggle input[type=checkbox]")

  const warnDefault = await warnInput.inputValue()
  const flagDefault = await flagInput.inputValue()
  const globsDefault = await globsTextarea.inputValue()
  const checkedCount = await checkToggles.evaluateAll((els) => els.filter((el) => el.checked).length)
  const totalChecks = await checkToggles.count()
  const bodyHasLoadingText = await optionsPage.evaluate(() => document.body.textContent.includes("Loading settings"))

  result.options.defaults =
    warnDefault === "400" &&
    flagDefault === "1000" &&
    globsDefault.includes("package-lock.json") &&
    globsDefault.includes("dist/**") &&
    totalChecks === 6 &&
    checkedCount === 6 &&
    !bodyHasLoadingText

  console.log(`options.defaults: warn=${warnDefault} flag=${flagDefault} checked=${checkedCount}/${totalChecks} loadingTextGone=${!bodyHasLoadingText} -> ${result.options.defaults}`)
  await optionsPage.screenshot({ path: join(evidenceDir, "screen3-options-defaults.png") })

  // Set warn to 5, blur to flush save.
  await warnInput.fill("5")
  await warnInput.evaluate((el) => el.blur())
  await optionsPage.waitForSelector(".prp-options-saved", { timeout: 5000 }).catch(() => null)
  await optionsPage.screenshot({ path: join(evidenceDir, "screen3-options-saved.png") })
  const warnAfterFirstSave = await warnInput.inputValue()
  console.log(`options warn field after save: ${warnAfterFirstSave}`)

  // --- Live re-run on the fixture page (second page, same context) ---
  const liveErrors = []
  const fixturePage = await context.newPage()
  trackConsole(fixturePage, liveErrors)
  let fixtureReachable = true
  try {
    await fixturePage.goto(FIXTURE_URL, { timeout: 30000 })
  } catch (err) {
    fixtureReachable = false
    console.error(`Fixture page navigation failed: ${err.message}`)
  }

  if (fixtureReachable) {
    const badge = fixturePage.locator("#pr-preflight-host .prp-badge")
    try {
      await badge.waitFor({ state: "visible", timeout: 20000 })
      await badge.click()
      const diffSizeRow = fixturePage.locator('#pr-preflight-host .prp-row:has-text("changed lines")')
      await diffSizeRow.waitFor({ timeout: 10000 })
      const diffSizeRowText = await diffSizeRow.innerText()
      const hasWarnPill = (await diffSizeRow.locator(".prp-pill-warn").count()) > 0
      result.options.liveRerun = diffSizeRowText.toLowerCase().includes("changed lines") && hasWarnPill
      console.log(`options.liveRerun: row="${diffSizeRowText.trim()}" warnPill=${hasWarnPill} -> ${result.options.liveRerun}`)
    } catch (err) {
      console.error(`Live re-run assertion failed: ${err.message}`)
    }
  } else {
    console.log("Skipping live re-run assertion: fixture page unreachable (network/login wall).")
  }
  await fixturePage.screenshot({ path: join(evidenceDir, "screen3-options-live-rerun.png") })

  // --- Clear warn field, blur, reload options, expect it still shows 5 (empty parses to null, never saved) ---
  await optionsPage.bringToFront()
  await warnInput.fill("")
  await warnInput.evaluate((el) => el.blur())
  await optionsPage.reload()
  await optionsPage.waitForSelector(".prp-options-field")
  await optionsPage.waitForFunction(() => !document.body.textContent.includes("Loading settings"))
  const warnInput2 = optionsPage.locator('input[type="number"]').nth(0)
  const warnAfterReload = await warnInput2.inputValue()
  result.options.clearNotSaved = warnAfterReload === "5"
  console.log(`options.clearNotSaved: field shows "${warnAfterReload}" after reload -> ${result.options.clearNotSaved}`)
  await optionsPage.screenshot({ path: join(evidenceDir, "screen3-options-clear-not-saved.png") })

  // --- Toggle Secrets off, confirm live panel loses the row and count drops by one ---
  const secretsToggle = optionsPage.locator('.prp-options-toggle:has-text("Secret patterns") input[type=checkbox]')
  let preSecretsCount = null
  let postSecretsCount = null
  let secretsRowGoneAfterToggle = false

  if (fixtureReachable) {
    preSecretsCount = await fixturePage.locator("#pr-preflight-host .prp-row:not(.prp-row-pass)").count()
  }

  await secretsToggle.uncheck()
  await optionsPage.waitForSelector('.prp-options-toggle:has-text("Secret patterns") .prp-options-saved', { timeout: 5000 }).catch(() => null)

  if (fixtureReachable) {
    await fixturePage
      .waitForSelector('#pr-preflight-host button[aria-controls="prp-row-items-secrets"]', { state: "detached", timeout: 5000 })
      .then(() => {
        secretsRowGoneAfterToggle = true
      })
      .catch(() => null)
    postSecretsCount = await fixturePage.locator("#pr-preflight-host .prp-row:not(.prp-row-pass)").count()
  }

  result.options.secretsOff = fixtureReachable && secretsRowGoneAfterToggle && postSecretsCount === preSecretsCount - 1
  console.log(`options.secretsOff: pre=${preSecretsCount} post=${postSecretsCount} rowGone=${secretsRowGoneAfterToggle} -> ${result.options.secretsOff}`)
  await optionsPage.screenshot({ path: join(evidenceDir, "screen3-options-secrets-off.png") })

  // --- Restore warn 400 and Secrets on ---
  await warnInput2.fill("400")
  await warnInput2.evaluate((el) => el.blur())
  await optionsPage.waitForSelector(".prp-options-saved", { timeout: 5000 }).catch(() => null)
  await secretsToggle.check()
  await optionsPage.waitForSelector('.prp-options-toggle:has-text("Secret patterns") .prp-options-saved', { timeout: 5000 }).catch(() => null)

  let restoredSecretsBack = false
  let restoredDiffSizePass = false
  if (fixtureReachable) {
    await fixturePage
      .waitForSelector('#pr-preflight-host button[aria-controls="prp-row-items-secrets"]', { timeout: 5000 })
      .then(() => {
        restoredSecretsBack = true
      })
      .catch(() => null)
    await fixturePage
      .waitForSelector('#pr-preflight-host .prp-row:has-text("Diff size is reasonable")', { timeout: 5000 })
      .then(() => {
        restoredDiffSizePass = true
      })
      .catch(() => null)
  }
  result.options.restored = fixtureReachable && restoredSecretsBack && restoredDiffSizePass
  console.log(`options.restored: secretsBack=${restoredSecretsBack} diffSizePass=${restoredDiffSizePass} -> ${result.options.restored}`)

  optionsErrors.push(...liveErrors)

  // --- Screen 4: Popup as a page ---
  const popupPage = await context.newPage()
  trackConsole(popupPage, popupErrors)
  await popupPage.goto(`chrome-extension://${extId}/popup.html`)
  await popupPage.waitForSelector(".prp-root")
  await popupPage.waitForTimeout(500)
  const popupBodyText = (await popupPage.locator(".prp-root").innerText()).trim()
  const rendersExplainer = popupBodyText.includes("Open a compare page on GitHub to see your preflight checklist.")
  const hasSettingsButton = (await popupPage.locator('button:has-text("Settings")').count()) > 0
  result.popup.renders = rendersExplainer && hasSettingsButton
  console.log(`popup.renders: explainer=${rendersExplainer} settingsButton=${hasSettingsButton} text="${popupBodyText}" -> ${result.popup.renders}`)
  await popupPage.screenshot({ path: join(evidenceDir, "screen4-popup-as-page.png") })

  await context.close()

  console.log(JSON.stringify(result, null, 2))

  const allPass =
    result.options.defaults &&
    result.options.liveRerun &&
    result.options.clearNotSaved &&
    result.options.secretsOff &&
    result.options.restored &&
    optionsErrors.length === 0 &&
    result.popup.renders &&
    popupErrors.length === 0

  process.exit(allPass ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
