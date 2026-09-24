export interface CompareUrl {
  owner: string
  repo: string
  range: string
}

const COMPARE_PATH = /^\/([^/]+)\/([^/]+)\/compare\/(.+?)\/?$/

export function parseCompareUrl(pathname: string): CompareUrl | null {
  const withoutQuery = pathname.split("?")[0]
  const match = withoutQuery.match(COMPARE_PATH)
  if (!match) return null
  const [, owner, repo, range] = match
  return { owner, repo, range }
}
