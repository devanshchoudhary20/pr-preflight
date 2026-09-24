export const selectors = {
  filesBucket: "#files_bucket",
  includeFragment: "include-fragment[aria-label='Loading Files']",
  fileRow: "#files_bucket .file[data-tagsearch-path]",
  filePathAttr: "data-tagsearch-path",
  addedLine: ".blob-code-addition .blob-code-inner",
  diffStat: ".diffstat"
}

// No-ops silently if the DOM fallback selector is absent (React diff DOM
// migration case) — this is one specific action screens.md says never
// surfaces an error, unlike the fetch/DOM-fallback path itself.
export function scrollToFile(path: string): void {
  const target = document.querySelector(`.file[${selectors.filePathAttr}="${CSS.escape(path)}"]`)
  target?.scrollIntoView({ behavior: "smooth", block: "start" })
}
