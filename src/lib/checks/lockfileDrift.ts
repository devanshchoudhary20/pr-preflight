import type { DiffFile } from "../diff"
import type { Finding, FindingItem } from "./types"
import { basename, stripAddedPrefix } from "./utils"

interface LockfilePair {
  manifest: string
  lockfiles: string[]
}

export const LOCKFILE_PAIRS: LockfilePair[] = [
  { manifest: "package.json", lockfiles: ["package-lock.json", "yarn.lock", "pnpm-lock.yaml", "bun.lock", "bun.lockb"] },
  { manifest: "pyproject.toml", lockfiles: ["poetry.lock", "uv.lock"] },
  { manifest: "Cargo.toml", lockfiles: ["Cargo.lock"] },
  { manifest: "go.mod", lockfiles: ["go.sum"] },
  { manifest: "Gemfile", lockfiles: ["Gemfile.lock"] }
]

export const LOCKFILE_NAMES = new Set(LOCKFILE_PAIRS.flatMap((pair) => pair.lockfiles))

const DEPENDENCY_MARKERS = ["dependencies", "devDependencies", "peerDependencies", "[dependencies]", "require", "gem "]

function manifestTouchesDependencies(file: DiffFile): boolean {
  return file.addedLines.some((addedLine) => {
    const content = stripAddedPrefix(addedLine.content)
    return DEPENDENCY_MARKERS.some((marker) => content.includes(marker))
  })
}

export function checkLockfileDrift(files: DiffFile[]): Finding {
  const items: FindingItem[] = []
  const notes: string[] = []

  for (const pair of LOCKFILE_PAIRS) {
    const manifestFile = files.find((file) => basename(file.path) === pair.manifest)
    const lockfileFile = files.find((file) => pair.lockfiles.includes(basename(file.path)))
    if (manifestFile && !lockfileFile && manifestTouchesDependencies(manifestFile)) {
      items.push({ path: manifestFile.path, snippet: `No paired lockfile changed for ${pair.manifest}` })
    } else if (lockfileFile && !manifestFile) {
      notes.push(`${lockfileFile.path} changed without ${pair.manifest}`)
    }
  }

  const level = items.length > 0 ? "warn" : "pass"
  let title: string
  if (level === "warn") {
    title = `${items.length} manifest${items.length === 1 ? "" : "s"} changed without a paired lockfile update`
  } else if (notes.length > 0) {
    title = `Lockfile updated without a manifest change (${notes.join("; ")})`
  } else {
    title = "Lockfiles match manifest changes"
  }
  return { id: "lockfile-drift", level, title, items }
}
