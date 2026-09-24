#!/usr/bin/env node
// Fails on any run of 2+ consecutive "why" comment lines: if a comment needs more than one line, the name is unclear.
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, extname } from "node:path"

const ROOT = join(import.meta.dirname, "..", "src")
const EXTENSIONS = new Set([".ts", ".tsx", ".css", ".mjs"])
const EXCLUDED_DIRS = new Set(["node_modules", "dist"])

function walk(dir) {
  const files = []
  for (const entry of readdirSync(dir)) {
    if (EXCLUDED_DIRS.has(entry)) continue
    const path = join(dir, entry)
    const stat = statSync(path)
    if (stat.isDirectory()) {
      files.push(...walk(path))
    } else if (EXTENSIONS.has(extname(entry))) {
      files.push(path)
    }
  }
  return files
}

function findSlashCommentRuns(lines) {
  const violations = []
  let runStart = null
  lines.forEach((line, index) => {
    const isComment = line.trim().startsWith("//")
    if (isComment && runStart === null) {
      runStart = index
    } else if (!isComment && runStart !== null) {
      if (index - runStart >= 2) violations.push([runStart + 1, index])
      runStart = null
    }
  })
  if (runStart !== null && lines.length - runStart >= 2) violations.push([runStart + 1, lines.length])
  return violations
}

function findCssBlockCommentRuns(lines) {
  const violations = []
  let blockStart = null
  lines.forEach((line, index) => {
    const trimmed = line.trim()
    if (blockStart === null && trimmed.includes("/*")) {
      const closesOnSameLine = trimmed.includes("*/", trimmed.indexOf("/*") + 2)
      if (!closesOnSameLine) blockStart = index
    } else if (blockStart !== null && trimmed.includes("*/")) {
      if (index - blockStart >= 1) violations.push([blockStart + 1, index + 1])
      blockStart = null
    }
  })
  return violations
}

function checkFile(path) {
  const content = readFileSync(path, "utf8")
  const lines = content.split("\n")
  const runs = extname(path) === ".css" ? findCssBlockCommentRuns(lines) : findSlashCommentRuns(lines)
  return runs.map(([start, end]) => `${path}:${start}-${end}`)
}

const files = walk(ROOT)
const violations = files.flatMap(checkFile)

if (violations.length > 0) {
  console.error(`${violations.length} multi-line comment run(s) found:`)
  violations.forEach((v) => console.error(`  ${v}`))
  process.exit(1)
}

console.log("No multi-line comments found.")
