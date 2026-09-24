import { chromium } from "playwright"
import { createHash } from "node:crypto"
import { mkdtemp, mkdir } from "node:fs/promises"
import { tmpdir } from "node:os"
import { resolve, dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const distDir = resolve(root, "dist")
const shotsDir = resolve(root, "store-assets")
const FIXTURE_URL = "https://github.com/devanshchoudhary20/prp-fixture/compare/main...feat/planted"
const VIEWPORT = { width: 1280, height: 800 }

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

async function shot(page, filename) {
  await page.screenshot({ path: join(shotsDir, filename), clip: { x: 0, y: 0, width: VIEWPORT.width, height: VIEWPORT.height } })
}

async function main() {
  await mkdir(shotsDir, { recursive: true })
  const extId = computeExtensionId(distDir)
  console.log(`Computed extension id: ${extId}`)

  const userDataDir = await mkdtemp(join(tmpdir(), "prp-store-shots-"))
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    args: [`--disable-extensions-except=${distDir}`, `--load-extension=${distDir}`, "--window-size=1280,900"]
  })

  const ready = await waitForExtensionReady(context, extId)
  if (!ready) {
    console.error("Extension never became reachable at the computed id. Aborting.")
    await context.close()
    process.exit(1)
  }
  console.log("Extension reachable, proceeding.")

  // --- 01: badge, collapsed, "5 to review" ---
  const badgePage = await context.newPage()
  await badgePage.setViewportSize(VIEWPORT)
  await badgePage.goto(FIXTURE_URL, { timeout: 30000 })
  const badge = badgePage.locator("#pr-preflight-host .prp-badge")
  await badge.waitFor({ state: "visible", timeout: 20000 })
  await badgePage.waitForFunction(
    () => document.querySelector("#pr-preflight-host")?.shadowRoot?.querySelector(".prp-badge-text")?.textContent?.trim() === "5 to review",
    null,
    { timeout: 20000 }
  )
  await shot(badgePage, "01-badge.png")

  // --- 02: panel open, six rows, sorted flag first ---
  await badge.click()
  const panel = badgePage.locator("#pr-preflight-host .prp-panel")
  await panel.waitFor({ state: "visible", timeout: 10000 })
  await badgePage.waitForFunction(
    () => {
      const root = document.querySelector("#pr-preflight-host")?.shadowRoot
      if (!root) return false
      const rows = root.querySelectorAll("li.prp-row:not(.prp-row-skeleton)")
      return rows.length === 6
    },
    null,
    { timeout: 15000 }
  )
  await shot(badgePage, "02-panel.png")

  // --- 03: Secrets row expanded, src/config.js:2, "AWS access key pattern" ---
  const secretsRowToggle = badgePage.locator('#pr-preflight-host button[aria-controls="prp-row-items-secrets"]')
  await secretsRowToggle.click()
  const secretsItem = badgePage.locator("#pr-preflight-host .prp-row-item-path", { hasText: "src/config.js:2" })
  await secretsItem.waitFor({ timeout: 10000 })
  await badgePage.waitForFunction(
    () => {
      const root = document.querySelector("#pr-preflight-host")?.shadowRoot
      if (!root) return false
      return Array.from(root.querySelectorAll(".prp-row-item-snippet")).some((el) => el.textContent?.includes("AWS access key pattern"))
    },
    null,
    { timeout: 10000 }
  )
  await badgePage.evaluate(() => window.scrollTo({ top: 120, left: 0, behavior: "instant" }))
  await badgePage.waitForTimeout(300)
  await shot(badgePage, "03-expanded-row.png")
  await badgePage.close()

  // --- 04: options.html defaults ---
  const optionsPage = await context.newPage()
  await optionsPage.setViewportSize(VIEWPORT)
  await optionsPage.goto(`chrome-extension://${extId}/options.html`)
  await optionsPage.waitForSelector(".prp-options-field")
  await optionsPage.waitForFunction(() => !document.body.textContent.includes("Loading settings"))
  await shot(optionsPage, "04-options.png")
  await optionsPage.close()

  // --- 05: popup.html as a page ---
  const popupPage = await context.newPage()
  await popupPage.setViewportSize(VIEWPORT)
  await popupPage.goto(`chrome-extension://${extId}/popup.html`)
  await popupPage.waitForSelector(".prp-root")
  await popupPage.waitForTimeout(500)
  await shot(popupPage, "05-popup.png")
  await popupPage.close()

  await context.close()
  console.log(`Screenshots written to ${shotsDir}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
