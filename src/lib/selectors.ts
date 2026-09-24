export const selectors = {
  filesBucket: "#files_bucket",
  includeFragment: "include-fragment[aria-label='Loading Files']",
  fileRow: "#files_bucket .file[data-tagsearch-path]",
  filePathAttr: "data-tagsearch-path",
  addedLine: ".blob-code-addition .blob-code-inner",
  diffStat: ".diffstat",
  // Unverified on the live page (chunk 1 spike did not confirm these); "Insert into description" degrades to absent when missing.
  pullRequestTitle: "#pull_request_title",
  pullRequestBody: "#pull_request_body"
}

// No-ops silently if absent (React diff DOM migration); this one action never surfaces an error per screens.md.
export function scrollToFile(path: string): void {
  const target = document.querySelector(`.file[${selectors.filePathAttr}="${CSS.escape(path)}"]`)
  target?.scrollIntoView({ behavior: "smooth", block: "start" })
}
