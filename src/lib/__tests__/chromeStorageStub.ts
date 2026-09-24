type Listener = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => void

function makeArea(data: Record<string, unknown>, areaName: string, listeners: Listener[]) {
  return {
    get: async (key?: string | string[] | null) => {
      if (key == null) return { ...data }
      const keys = Array.isArray(key) ? key : [key]
      const result: Record<string, unknown> = {}
      for (const k of keys) if (k in data) result[k] = data[k]
      return result
    },
    set: async (items: Record<string, unknown>) => {
      const changes: Record<string, chrome.storage.StorageChange> = {}
      for (const [k, v] of Object.entries(items)) {
        changes[k] = { oldValue: data[k], newValue: v }
        data[k] = v
      }
      listeners.forEach((listener) => listener(changes, areaName))
    },
    remove: async (key: string | string[]) => {
      const keys = Array.isArray(key) ? key : [key]
      for (const k of keys) delete data[k]
    }
  }
}

// Tiny in-memory stand-in for chrome.storage.{sync,local} plus onChanged, enough for tests (no real extension runtime).
export function installChromeStorageStub(): void {
  const syncData: Record<string, unknown> = {}
  const localData: Record<string, unknown> = {}
  const listeners: Listener[] = []
  const stub = {
    storage: {
      sync: makeArea(syncData, "sync", listeners),
      local: makeArea(localData, "local", listeners),
      onChanged: {
        addListener: (fn: Listener) => listeners.push(fn),
        removeListener: (fn: Listener) => {
          const index = listeners.indexOf(fn)
          if (index >= 0) listeners.splice(index, 1)
        }
      }
    }
  }
  ;(globalThis as unknown as { chrome: typeof stub }).chrome = stub
}
