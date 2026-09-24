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
const CLEAN_URL = "https://github.com/devanshchoudhary20/prp-fixture/compare/main...docs/clean"

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

// Pads a valid unified-diff body past the given byte target, for the "diff too large" route fixture.
function buildTooLargeDiffBody(targetBytes) {
  const line = "+padding line to inflate the diff body past the two megabyte cap\n"
  let body = "diff --git a/big.txt b/big.txt\n--- a/big.txt\n+++ b/big.txt\n@@ -1,1 +1,999999 @@\n"
  while (Buffer.byteLength(body, "utf8") < targetBytes) body += line
  return body
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
    options: {
      defaults: false,
      liveRerun: false,
      clearNotSaved: false,
      secretsOff: false,
      secretsOffPanel: false,
      secretsOffBadgeCount: false,
      restored: false,
      restoredPanel: false,
      invalidGlob: false,
      invalidGlobValidSaved: false,
      consoleErrors: optionsErrors
    },
    popup: { renders: false, settingsOpensOptions: false, consoleErrors: popupErrors },
    loading: { badge: false, panel: false, consoleErrors: [] },
    clean: { allPass: false, consoleErrors: [] },
    tooLarge: { singleFlagRow: false, consoleErrors: [] },
    networkFallback: { outcome: null, consoleErrors: [] },
    retry: { retryButtonAppeared: false, recovered: false, consoleErrors: [] },
    itemScroll: { changed: false }
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

  // --- New evidence: whole-panel row count + badge count after the Secrets toggle goes off ---
  const totalRowsLocator = fixturePage.locator("#pr-preflight-host li.prp-row")
  let totalRowsAfterSecretsOff = null
  let hasSecretsRowTitle = null
  let badgeCountAfterSecretsOff = null

  if (fixtureReachable) {
    totalRowsAfterSecretsOff = await totalRowsLocator.count()
    const rowTitles = await fixturePage.locator("#pr-preflight-host .prp-row-title").allInnerTexts()
    hasSecretsRowTitle = rowTitles.some((title) => /secret/i.test(title))

    // Collapse to badge to read the count directly, then re-expand for the panel screenshot.
    await fixturePage.locator("#pr-preflight-host .prp-panel-collapse").click()
    await fixturePage.locator("#pr-preflight-host .prp-badge").waitFor({ state: "visible", timeout: 5000 })
    const badgeTextAfterSecretsOff = await fixturePage.locator("#pr-preflight-host .prp-badge-text").innerText()
    badgeCountAfterSecretsOff = parseInt(badgeTextAfterSecretsOff, 10)
    await fixturePage.locator("#pr-preflight-host .prp-badge").click()
    await fixturePage.locator("#pr-preflight-host .prp-panel").waitFor({ state: "visible", timeout: 5000 })
  }

  result.options.secretsOffPanel = fixtureReachable && totalRowsAfterSecretsOff === 5 && hasSecretsRowTitle === false
  result.options.secretsOffBadgeCount = fixtureReachable && badgeCountAfterSecretsOff === postSecretsCount
  console.log(`options.secretsOffPanel: totalRows=${totalRowsAfterSecretsOff} hasSecretsRowTitle=${hasSecretsRowTitle} -> ${result.options.secretsOffPanel}`)
  console.log(`options.secretsOffBadgeCount: badgeCount=${badgeCountAfterSecretsOff} expected=${postSecretsCount} -> ${result.options.secretsOffBadgeCount}`)
  await fixturePage.screenshot({ path: join(evidenceDir, "screen3-options-secrets-off-panel.png") })

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

  // --- New evidence: whole-panel row count back to 6 after restore ---
  const totalRowsAfterRestore = fixtureReachable ? await totalRowsLocator.count() : null
  result.options.restoredPanel = fixtureReachable && totalRowsAfterRestore === 6
  console.log(`options.restoredPanel: totalRows=${totalRowsAfterRestore} -> ${result.options.restoredPanel}`)
  await fixturePage.screenshot({ path: join(evidenceDir, "screen3-options-restored-panel.png") })

  // --- Item scroll: expand the Secrets row, click the file path, confirm the underlying page scrolled ---
  let scrollChanged = false
  if (fixtureReachable) {
    const secretsRowToggle = fixturePage.locator('#pr-preflight-host button[aria-controls="prp-row-items-secrets"]')
    await secretsRowToggle.click()
    const secretsItemPath = fixturePage.locator("#pr-preflight-host .prp-row-item-path", { hasText: "src/config.js" })
    await secretsItemPath.waitFor({ timeout: 5000 })
    const scrollYBefore = await fixturePage.evaluate(() => window.scrollY)
    await secretsItemPath.click()
    await fixturePage.waitForTimeout(800)
    const scrollYAfter = await fixturePage.evaluate(() => window.scrollY)
    scrollChanged = scrollYAfter !== scrollYBefore
    console.log(`itemScroll: before=${scrollYBefore} after=${scrollYAfter} -> ${scrollChanged}`)
  }
  result.itemScroll.changed = fixtureReachable && scrollChanged
  await fixturePage.screenshot({ path: join(evidenceDir, "screen2-item-scroll.png") })

  optionsErrors.push(...liveErrors)

  // --- Invalid ignore-glob line: kept in the textarea, flagged inline, valid lines still save ---
  const INVALID_GLOB_LINE = "bad glob line"
  const globsBeforeInvalid = await globsTextarea.inputValue()
  await globsTextarea.fill(`${globsBeforeInvalid}\n${INVALID_GLOB_LINE}`)
  await globsTextarea.evaluate((el) => el.blur())
  await optionsPage.waitForSelector(".prp-options-invalid", { timeout: 5000 }).catch(() => null)
  const invalidBannerText = await optionsPage.locator(".prp-options-invalid").innerText().catch(() => "")
  const savedConfigAfterInvalid = await optionsPage.evaluate(
    () => new Promise((resolve) => chrome.storage.sync.get("config", (stored) => resolve(stored.config)))
  )
  const invalidGlobFlagged = invalidBannerText.includes(INVALID_GLOB_LINE)
  const validGlobsStillSaved =
    Array.isArray(savedConfigAfterInvalid?.ignoreGlobs) &&
    savedConfigAfterInvalid.ignoreGlobs.includes("package-lock.json") &&
    !savedConfigAfterInvalid.ignoreGlobs.includes(INVALID_GLOB_LINE)
  result.options.invalidGlob = invalidGlobFlagged
  result.options.invalidGlobValidSaved = validGlobsStillSaved
  console.log(`options.invalidGlob: banner="${invalidBannerText.trim()}" flagged=${invalidGlobFlagged} validSaved=${validGlobsStillSaved}`)
  await optionsPage.screenshot({ path: join(evidenceDir, "screen3-options-invalid-glob.png") })

  // Close the options tab so openOptionsPage() below opens a genuinely new tab instead of focusing this one.
  await optionsPage.close()

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

  // --- Popup: click Settings, confirm options.html opens in a new tab ---
  const settingsButton = popupPage.locator('button:has-text("Settings")')
  const [settingsPage] = await Promise.all([context.waitForEvent("page"), settingsButton.click()])
  await settingsPage.waitForLoadState().catch(() => null)
  const settingsPageUrl = settingsPage.url()
  result.popup.settingsOpensOptions = settingsPageUrl.includes("options.html")
  console.log(`popup.settingsOpensOptions: url=${settingsPageUrl} -> ${result.popup.settingsOpensOptions}`)
  await settingsPage.screenshot({ path: join(evidenceDir, "screen4-popup-settings-click.png") })
  await settingsPage.close()

  // --- Screen 1/2 loading: delay the .diff response, capture badge "Checking\u2026" then panel skeleton ---
  const LOADING_DELAY_MS = 6000
  const loadingErrors = []
  const loadingPage = await context.newPage()
  trackConsole(loadingPage, loadingErrors)
  await loadingPage.route("**/compare/**.diff", async (route) => {
    await new Promise((r) => setTimeout(r, LOADING_DELAY_MS))
    await route.continue()
  })
  await loadingPage.goto(FIXTURE_URL, { timeout: 30000 })
  const loadingBadge = loadingPage.locator("#pr-preflight-host .prp-badge")
  await loadingBadge.waitFor({ state: "visible", timeout: 10000 })
  const loadingBadgeText = await loadingPage.locator("#pr-preflight-host .prp-badge-text").innerText()
  const loadingDotNeutral = (await loadingPage.locator("#pr-preflight-host .prp-dot-neutral").count()) > 0
  result.loading.badge = loadingBadgeText.trim() === "Checking\u2026" && loadingDotNeutral
  console.log(`loading.badge: text="${loadingBadgeText.trim()}" neutralDot=${loadingDotNeutral} -> ${result.loading.badge}`)
  await loadingPage.screenshot({ path: join(evidenceDir, "screen1-badge-loading.png") })

  await loadingBadge.click()
  await loadingPage.waitForSelector("#pr-preflight-host .prp-row-skeleton", { timeout: 3000 }).catch(() => null)
  const skeletonCount = await loadingPage.locator("#pr-preflight-host .prp-row-skeleton").count()
  const fetchingText = await loadingPage.locator("#pr-preflight-host .prp-panel-status").innerText().catch(() => "")
  result.loading.panel = skeletonCount === 6 && fetchingText.trim() === "Fetching diff\u2026"
  console.log(`loading.panel: skeletons=${skeletonCount} status="${fetchingText.trim()}" -> ${result.loading.panel}`)
  await loadingPage.screenshot({ path: join(evidenceDir, "screen2-panel-loading.png") })
  await loadingPage.waitForTimeout(LOADING_DELAY_MS)
  result.loading.consoleErrors.push(...loadingErrors)
  await loadingPage.close()

  // Reads a consistent, single-instant snapshot of the panel (avoids racing separate locator round-trips
  // against React's async loading -> DOM-fallback -> ready transition).
  async function readPanelSnapshot(page) {
    return page.evaluate(() => {
      const root = document.querySelector("#pr-preflight-host")?.shadowRoot
      if (!root) return null
      const rows = Array.from(root.querySelectorAll("li.prp-row:not(.prp-row-skeleton)"))
      return {
        totalRows: rows.length,
        passRows: rows.filter((r) => r.classList.contains("prp-row-pass")).length,
        warnRows: rows.filter((r) => r.classList.contains("prp-row-warn")).length,
        flagRows: rows.filter((r) => r.classList.contains("prp-row-flag")).length,
        titles: rows.map((r) => r.querySelector(".prp-row-title")?.textContent ?? ""),
        hasSkeleton: !!root.querySelector(".prp-row-skeleton"),
        hasErrorHeading: !!root.querySelector(".prp-panel-error-heading"),
        hasRetryButton: !!root.querySelector(".prp-panel-error button"),
        statusText: root.querySelector(".prp-panel-status")?.textContent ?? ""
      }
    })
  }

  // Settles once loading finishes: either real rows exist or the combined-error block appears.
  async function waitForPanelSettled(page, timeout = 20000) {
    await page
      .waitForFunction(
        () => {
          const root = document.querySelector("#pr-preflight-host")?.shadowRoot
          if (!root) return false
          if (root.querySelector(".prp-row-skeleton")) return false
          const hasRows = root.querySelectorAll("li.prp-row:not(.prp-row-skeleton)").length > 0
          const hasError = !!root.querySelector(".prp-panel-error")
          return hasRows || hasError
        },
        null,
        { timeout }
      )
      .catch(() => null)
  }

  // --- Clean branch: docs-only diff, all six checks pass ---
  const cleanErrors = []
  const cleanPage = await context.newPage()
  trackConsole(cleanPage, cleanErrors)
  await cleanPage.goto(CLEAN_URL, { timeout: 30000 })
  const cleanBadge = cleanPage.locator("#pr-preflight-host .prp-badge")
  await cleanBadge.waitFor({ state: "visible", timeout: 20000 })
  await cleanBadge.click()
  await waitForPanelSettled(cleanPage)
  const cleanSnapshot = await readPanelSnapshot(cleanPage)
  const cleanTestsRowMatch = (cleanSnapshot?.titles ?? []).some((t) => t.trim() === "No source files changed")
  result.clean.allPass = cleanSnapshot?.totalRows === 6 && cleanSnapshot?.passRows === 6 && cleanTestsRowMatch
  console.log(`clean.allPass: snapshot=${JSON.stringify(cleanSnapshot)} testsRowMatch=${cleanTestsRowMatch} -> ${result.clean.allPass}`)
  await cleanPage.screenshot({ path: join(evidenceDir, "screen2-panel-clean-allpass.png") })
  result.clean.consoleErrors.push(...cleanErrors)
  await cleanPage.close()

  // --- Diff too large: content-length over the 2 MB cap short-circuits to a single flag-level "Diff size" row ---
  const tooLargeBody = buildTooLargeDiffBody(3_000_000)
  const tooLargeBytes = Buffer.byteLength(tooLargeBody, "utf8")

  const tooLargeErrors = []
  const tooLargePage = await context.newPage()
  trackConsole(tooLargePage, tooLargeErrors)
  await tooLargePage.route("**/compare/**.diff", (route) =>
    route.fulfill({
      status: 200,
      headers: { "content-type": "text/plain", "content-length": String(tooLargeBytes) },
      body: tooLargeBody
    })
  )
  await tooLargePage.goto(FIXTURE_URL, { timeout: 30000 })
  const tooLargeBadge = tooLargePage.locator("#pr-preflight-host .prp-badge")
  await tooLargeBadge.waitFor({ state: "visible", timeout: 20000 })
  await tooLargeBadge.click()
  await waitForPanelSettled(tooLargePage)
  const tooLargeSnapshot = await readPanelSnapshot(tooLargePage)
  const tooLargeTitle = (tooLargeSnapshot?.titles ?? [])[0] ?? ""
  result.tooLarge.singleFlagRow =
    tooLargeSnapshot?.totalRows === 1 &&
    tooLargeSnapshot?.flagRows === 1 &&
    /too large to check in the browser/.test(tooLargeTitle) &&
    /cap is 2 MB\)\. Showing size only\.$/.test(tooLargeTitle.trim())
  console.log(`tooLarge.singleFlagRow: snapshot=${JSON.stringify(tooLargeSnapshot)} -> ${result.tooLarge.singleFlagRow}`)
  await tooLargePage.screenshot({ path: join(evidenceDir, "screen2-panel-too-large.png") })
  result.tooLarge.consoleErrors.push(...tooLargeErrors)
  await tooLargePage.close()

  // --- Network fallback: abort the .diff request entirely, check whether DOM fallback or the combined error wins ---
  const fallbackErrors = []
  const fallbackPage = await context.newPage()
  trackConsole(fallbackPage, fallbackErrors)
  await fallbackPage.route("**/compare/**.diff", (route) => route.abort("failed"))
  await fallbackPage.goto(FIXTURE_URL, { timeout: 30000 })
  const fallbackBadge = fallbackPage.locator("#pr-preflight-host .prp-badge")
  await fallbackBadge.waitFor({ state: "visible", timeout: 20000 })
  await fallbackBadge.click()
  await waitForPanelSettled(fallbackPage)
  const fallbackSnapshot = await readPanelSnapshot(fallbackPage)
  result.networkFallback.outcome =
    fallbackSnapshot?.totalRows === 6
      ? "dom-fallback-success"
      : fallbackSnapshot?.hasErrorHeading
        ? "combined-error"
        : "inconclusive"
  console.log(`networkFallback.outcome: ${result.networkFallback.outcome} snapshot=${JSON.stringify(fallbackSnapshot)}`)
  await fallbackPage.screenshot({ path: join(evidenceDir, "screen2-panel-network-fallback.png") })
  result.networkFallback.consoleErrors.push(...fallbackErrors)
  await fallbackPage.close()

  // --- Retry: abort only the first .diff request, then exercise Retry if the panel ever shows the error state ---
  const retryErrors = []
  const retryPage = await context.newPage()
  trackConsole(retryPage, retryErrors)
  let retryRequestCount = 0
  await retryPage.route("**/compare/**.diff", (route) => {
    retryRequestCount += 1
    if (retryRequestCount === 1) return route.abort("failed")
    return route.continue()
  })
  await retryPage.goto(FIXTURE_URL, { timeout: 30000 })
  const retryBadge = retryPage.locator("#pr-preflight-host .prp-badge")
  await retryBadge.waitFor({ state: "visible", timeout: 20000 })
  await retryBadge.click()
  await waitForPanelSettled(retryPage)

  const retrySnapshotBefore = await readPanelSnapshot(retryPage)
  result.retry.retryButtonAppeared = !!retrySnapshotBefore?.hasRetryButton
  if (result.retry.retryButtonAppeared) {
    await retryPage.locator('#pr-preflight-host .prp-panel-error button:has-text("Retry")').click()
    await waitForPanelSettled(retryPage)
  }
  const retrySnapshotAfter = await readPanelSnapshot(retryPage)
  result.retry.recovered = retrySnapshotAfter?.totalRows === 6
  console.log(
    `retry: retryButtonAppeared=${result.retry.retryButtonAppeared} requestsSeen=${retryRequestCount} before=${JSON.stringify(retrySnapshotBefore)} after=${JSON.stringify(retrySnapshotAfter)} -> recovered=${result.retry.recovered}`
  )
  await retryPage.screenshot({ path: join(evidenceDir, "screen2-panel-retry.png") })
  result.retry.consoleErrors.push(...retryErrors)
  await retryPage.close()


  await context.close()

  console.log(JSON.stringify(result, null, 2))

  const allPass =
    result.options.defaults &&
    result.options.liveRerun &&
    result.options.clearNotSaved &&
    result.options.secretsOff &&
    result.options.secretsOffPanel &&
    result.options.secretsOffBadgeCount &&
    result.options.restored &&
    result.options.restoredPanel &&
    result.options.invalidGlob &&
    result.options.invalidGlobValidSaved &&
    optionsErrors.length === 0 &&
    result.popup.renders &&
    result.popup.settingsOpensOptions &&
    popupErrors.length === 0 &&
    result.loading.badge &&
    result.loading.panel &&
    result.loading.consoleErrors.length === 0 &&
    result.clean.allPass &&
    result.clean.consoleErrors.length === 0 &&
    result.tooLarge.singleFlagRow &&
    result.tooLarge.consoleErrors.length === 0 &&
    result.networkFallback.outcome !== "inconclusive" &&
    result.networkFallback.consoleErrors.length === 0 &&
    result.retry.recovered &&
    result.retry.consoleErrors.length === 0 &&
    result.itemScroll.changed

  process.exit(allPass ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
