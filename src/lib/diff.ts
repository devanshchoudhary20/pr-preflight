import parseDiffLib from "parse-diff"

export interface AddedLine {
  lineNo: number
  content: string
}

export interface DiffFile {
  path: string
  additions: number
  deletions: number
  addedLines: AddedLine[]
}

export interface DiffStats {
  files: number
  additions: number
  deletions: number
}

export class DiffFetchError extends Error {
  status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.name = "DiffFetchError"
    this.status = status
  }
}

interface FetchDiffOptions {
  signal?: AbortSignal
}

export async function fetchDiff(
  owner: string,
  repo: string,
  range: string,
  { signal }: FetchDiffOptions = {}
): Promise<string> {
  const url = `${location.origin}/${owner}/${repo}/compare/${range}.diff`
  let response: Response
  try {
    response = await fetch(url, { credentials: "include", signal })
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err
    throw new DiffFetchError("network request failed before a response was received")
  }
  if (!response.ok) {
    throw new DiffFetchError(`GitHub responded with status ${response.status}`, response.status)
  }
  return response.text()
}

// GitHub's diff always addresses the added-line path via "to"; fall back to
// "from" for pure deletions where "to" is /dev/null.
function resolvePath(file: parseDiffLib.File): string {
  if (file.to && file.to !== "/dev/null") return file.to
  if (file.from && file.from !== "/dev/null") return file.from
  return "(unknown file)"
}

export function parseDiff(text: string): DiffFile[] {
  const files = parseDiffLib(text)
  return files.map((file) => {
    const addedLines: AddedLine[] = []
    for (const chunk of file.chunks) {
      for (const change of chunk.changes) {
        if (change.type === "add") {
          addedLines.push({ lineNo: change.ln, content: change.content })
        }
      }
    }
    return {
      path: resolvePath(file),
      additions: file.additions ?? 0,
      deletions: file.deletions ?? 0,
      addedLines
    }
  })
}

export function diffStats(files: DiffFile[]): DiffStats {
  return files.reduce(
    (acc, file) => ({
      files: acc.files + 1,
      additions: acc.additions + file.additions,
      deletions: acc.deletions + file.deletions
    }),
    { files: 0, additions: 0, deletions: 0 }
  )
}
