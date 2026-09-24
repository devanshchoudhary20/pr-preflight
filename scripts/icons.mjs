import { readFileSync, mkdirSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import sharp from "sharp"

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const svg = readFileSync(resolve(root, "assets/icon.svg"))
const outDir = resolve(root, "icons")
mkdirSync(outDir, { recursive: true })

const sizes = [16, 48, 128]

for (const size of sizes) {
  await sharp(svg, { density: 384 })
    .resize(size, size)
    .png()
    .toFile(resolve(outDir, `icon${size}.png`))
  console.log(`wrote icons/icon${size}.png`)
}
