export const selectors = {
  filesBucket: "#files_bucket",
  includeFragment: "include-fragment[aria-label='Loading Files']",
  fileRow: "#files_bucket .file[data-tagsearch-path]",
  filePathAttr: "data-tagsearch-path",
  addedLine: ".blob-code-addition .blob-code-inner",
  diffStat: ".diffstat",
  // Present on compare pages with ?expand=1 (the shape /pull/new/<branch> redirects to), where GitHub renders the PR form inline.
  pullRequestTitle: "#pull_request_title",
  pullRequestBody: "#pull_request_body"
}

// No-ops silently if absent (React diff DOM migration); this one action never surfaces an error per screens.md.
export function scrollToFile(path: string): void {
  const target = document.querySelector(`.file[${selectors.filePathAttr}="${CSS.escape(path)}"]`)
  target?.scrollIntoView({ behavior: "smooth", block: "start" })
}

// Item paths render as links only when the underlying page can actually be scrolled to; read once, not per-item, since the file list doesn't change while a row is expanded.
export function existingFilePaths(): Set<string> {
  const rows = document.querySelectorAll<HTMLElement>(selectors.fileRow)
  return new Set(Array.from(rows, (row) => row.getAttribute(selectors.filePathAttr) ?? ""))
}
