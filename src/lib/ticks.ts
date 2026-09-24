const TICK_TTL_MS = 7 * 24 * 60 * 60 * 1000

interface TickRecord {
  checkedIds: string[]
  savedAt: number
}

function tickKey(owner: string, repo: string, range: string): string {
  return `ticks:${owner}/${repo}/${range}`
}

function isExpired(record: TickRecord): boolean {
  return Date.now() - record.savedAt > TICK_TTL_MS
}

export async function loadTicks(owner: string, repo: string, range: string): Promise<Set<string>> {
  const key = tickKey(owner, repo, range)
  const stored = await chrome.storage.local.get(key)
  const record = stored[key] as TickRecord | undefined
  if (!record) return new Set()
  if (isExpired(record)) {
    await chrome.storage.local.remove(key)
    return new Set()
  }
  return new Set(record.checkedIds ?? [])
}

export async function setTick(owner: string, repo: string, range: string, id: string, checked: boolean): Promise<Set<string>> {
  const current = await loadTicks(owner, repo, range)
  if (checked) current.add(id)
  else current.delete(id)
  const key = tickKey(owner, repo, range)
  await chrome.storage.local.set({ [key]: { checkedIds: [...current], savedAt: Date.now() } satisfies TickRecord })
  return current
}
