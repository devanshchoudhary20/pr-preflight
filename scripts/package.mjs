import { execSync } from "node:child_process"
import { readFileSync, mkdirSync, existsSync, rmSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const manifest = JSON.parse(readFileSync(resolve(root, "manifest.json"), "utf8"))
const version = manifest.version

console.log("Building…")
execSync("npm run build", { cwd: root, stdio: "inherit" })

const releaseDir = resolve(root, "release")
mkdirSync(releaseDir, { recursive: true })

const zipPath = resolve(releaseDir, `pr-preflight-${version}.zip`)
if (existsSync(zipPath)) rmSync(zipPath)

// Zip from inside dist/ so manifest.json lands at the archive root, excluding source maps.
execSync(`zip -r "${zipPath}" . -x "*.map"`, { cwd: resolve(root, "dist"), stdio: "inherit" })

console.log(`Wrote ${zipPath}`)
