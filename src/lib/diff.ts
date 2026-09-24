import parseDiffLib from "parse-diff"

export interface AddedLine {
  lineNo?: number
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

// sizeMb is a string, not a number, so it can carry the "over 2" fallback when the byte count is unknown.
export class DiffTooLargeError extends Error {
  sizeMb: string
  constructor(sizeMb: string) {
    super("diff exceeds the 2 MB cap")
    this.name = "DiffTooLargeError"
    this.sizeMb = sizeMb
  }
}

export const DIFF_SIZE_CAP_BYTES = 2 * 1024 * 1024

function formatSizeMb(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1)
}

// Checks content-length first to skip the download when GitHub reports a size up front.
async function readWithCap(response: Response): Promise<string> {
  const declaredBytes = Number(response.headers.get("content-length"))
  if (Number.isFinite(declaredBytes) && declaredBytes > DIFF_SIZE_CAP_BYTES) {
    if (response.body) await response.body.cancel().catch(() => {})
    throw new DiffTooLargeError(formatSizeMb(declaredBytes))
  }

  const reader = response.body?.getReader()
  if (!reader) {
    const text = await response.text()
    if (text.length > DIFF_SIZE_CAP_BYTES) throw new DiffTooLargeError("over 2")
    return text
  }

  const decoder = new TextDecoder()
  let receivedBytes = 0
  let result = ""
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    receivedBytes += value.byteLength
    if (receivedBytes > DIFF_SIZE_CAP_BYTES) {
      await reader.cancel().catch(() => {})
      throw new DiffTooLargeError("over 2")
    }
    result += decoder.decode(value, { stream: true })
  }
  result += decoder.decode()
  return result
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
  return readWithCap(response)
}

// Falls back to "from" for pure deletions, where "to" is /dev/null.
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
