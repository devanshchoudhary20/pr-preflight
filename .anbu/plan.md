# PR Preflight — THINK plan

slug: 20260616-pr-preflight-extension
track: weekend
date: 2026-09-24
score: 8 (Rubric A)
ambiguous: false

## Acceptance line

v1 is done when a stranger can open a GitHub compare or new-PR page for their own branch and, with no key and no setup, see a pass/warn/flag checklist of six heuristic findings computed from that branch's real diff.

## Competitor search (3 queries + 2 follow-ups, 2026-09-24)

| Product | Where it runs | Who it serves | Key needed | Price |
|---|---|---|---|---|
| GitBrief (solasamuel, Apr 2026) | `/pull/N` sidebar | reviewer | Claude BYOK | free tier |
| PR Checklistify (FooQoo) | `/pull/N` | reviewer | OpenAI/Gemini/Claude BYOK | free, OSS |
| AI Code Reviewer for GitHub/GitLab/Bitbucket | `/pull/N` | reviewer | bundled or BYOK | free 20/mo, $9.99/mo |
| Git AutoReview | `/pull/N` + VS Code | reviewer | account + optional BYOK | free 10/day, $8.33/mo |
| heshamMassoud/github-pr-checklist, gt53/pull-request-checklist | `/pull/N` | reviewer, static team checklist | none | free |
| Refined GitHub | `/compare` and PR form | author | none | free |

The one thing none of them do: read the diff **before the PR exists** (`/compare`, `/pull/new`) and run content checks without an API key. Refined GitHub is the only author-side tool on the compare page and its checks are form-level (`warn-pr-from-master`, `suggest-commit-title-limit`, `prevent-duplicate-pr-submission`), never diff-content. No extension named "PR Preflight" exists in the store or on GitHub.

Moat is thin: Refined GitHub or Copilot could add these checks. Speed and a clean single-purpose listing are the edge. Ship fast, name it clearly.

Vault check: nothing in Shipped or Parked overlaps. `vibe-changelog` (parked) is adjacent post-ship summarization, not this.

## Rubric A

| Criterion | Score | Evidence |
|---|---|---|
| Weekend-sized | 2 | content script + `.diff` fetch + `parse-diff` + 6 pure-function checks + one panel. No integrations. Prior MV3 extension shipped in 5 days. |
| Zero cost, no babysitting | 2 | No API on the core path. Only network call is same-origin `github.com/*.diff`. BYOK LLM deferred to `## later`. |
| Distribution to 50 users | 2 | Chrome Web Store (keywords "github pull request checklist") + Show HN. Store pipeline already exists from semantic-bookmark-search (`STORE_LISTING.md`, `store-assets/`, `marketing/show-hn.md`). |
| Gap survives search | 1 | Six competitors named; all reviewer-side on `/pull/N`. Gap is real but Refined GitHub could close it in one feature PR. |
| Niche fit and freshness | 1 | Niche 1 (Chrome ext, dev tools) exact. Signals (Stage Show HN Apr 2026, Faros report) are older than 90 days. GitHub's React "Files changed" default (Jan 2026) is also old. |

Total: 8. Verdict: build.

## Stack

Vite 5 + `@crxjs/vite-plugin` (MV3) + React 18 + TypeScript. Not Plasmo.

- Content script matched on `https://github.com/*/*/compare/*` and `https://github.com/*/*/pull/new/*`. `run_at: document_idle`.
- Panel mounts inside a Shadow DOM host appended to `document.body` so GitHub CSS never leaks in or out. Panel CSS imported with `?inline` and injected into the shadow root. Plain CSS, not Tailwind (avoids the preflight-in-shadow-DOM dance for a five-component panel).
- Permissions: `storage` only. `host_permissions: ["https://github.com/*"]`. No remote code, no other hosts. Keep the store review surface minimal.
- Diff parsing: `parse-diff` (npm, zero deps). Reuse audit: grepped need is "unified diff to files/hunks/added lines"; `parse-diff` does exactly that; do not hand-roll.
- Tests: Vitest on the pure `runChecks()` with fixture diffs. Save `vitejs/vite compare v5.4.10...v5.4.11.diff` as the first fixture.
- Reuse from `~/developer/personal/projects/20260616-semantic-bookmark-search`: the `~` alias in `vite.config.ts`, `tsconfig.json`, icon pipeline, `STORE_LISTING.md` and `marketing/` structure. That project is plain Vite + `vite-plugin-static-copy` with a popup only; this one needs a content script with CSS, which is why CRXJS earns its place here.

## Where the diff is read (verified 2026-09-24 against github.com)

Primary source, not the DOM:

1. Parse `location.pathname` with `/^\/([^/]+)\/([^/]+)\/compare\/(.+?)\/?$/`. Capture `owner`, `repo`, `range`. `/pull/new/<branch>` 302s to `/compare/<branch>?expand=1`, so the content script only ever sees the compare URL. Strip the query string.
2. `fetch(`${location.origin}/${owner}/${repo}/compare/${range}.diff`, { credentials: "include" })`. Verified: returns `200 text/plain; charset=utf-8` with a raw unified diff. Same-origin with cookies, so private repos work. `.patch` also works but includes commit headers; use `.diff`.
3. Feed the text to `parse-diff`. Everything downstream is pure.

Fallback (DOM), used only if the fetch fails or the diff exceeds the size cap:

- The compare page loads files lazily via `<include-fragment aria-label="Loading Files" src="/owner/repo/compare/file-list?range=...">` into `#files_bucket`. Wait for that fragment's `load` event or a MutationObserver on `#files_bucket`.
- Per file: `#files_bucket .file[data-tagsearch-path]`. Path from `data-tagsearch-path`. Added lines from `.blob-code-addition .blob-code-inner`. Stats from `.diffstat`. All of these were present (7 files, 95 additions) in the fetched fragment on 2026-09-24. This is still the legacy Rails DOM, not the React "Files changed" DOM, so expect GitHub to migrate it.
- Keep every selector in one `src/lib/selectors.ts` so a migration is a one-file fix.

Mount point: Shadow DOM host on `body`, fixed to the right edge, collapsed to a badge showing counts. Do not depend on any GitHub container for mounting. Optional scroll-to-file uses `.file[data-tagsearch-path="<path>"]` and no-ops if absent.

Form fields (`#pull_request_title`, `#pull_request_body`) only render when logged in. Chunk 1 includes a 10-minute logged-in spike to confirm those ids before chunk 3 uses them for "copy as markdown into body".

## The six checks (exact)

All run on `parse-diff` output. Each returns `{ id, level: "pass" | "warn" | "flag", title, items: { path, line?, snippet? }[] }`. Ignore globs apply before every check. Default ignores: `*.lock`, `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `*.min.*`, `dist/**`, `build/**`, `*.snap`, `*.map`, `vendor/**`.

| # | Check | Rule | Level |
|---|---|---|---|
| 1 | Diff size | changed lines = additions + deletions after ignores. warn > 400 lines or > 20 files. flag > 1000 lines or > 50 files. Shows the numbers. | warn / flag |
| 2 | TODO / FIXME left in | added lines matching `/\b(TODO|FIXME|XXX|HACK)\b/`. Lists path:line and the line. | warn |
| 3 | Secret patterns | added lines matching any of: `AKIA[0-9A-Z]{16}`, `gh[pousr]_[A-Za-z0-9]{36,}`, `xox[baprs]-[A-Za-z0-9-]{10,}`, `sk-ant-[A-Za-z0-9_-]{20,}`, `sk_live_[A-Za-z0-9]{16,}`, `sk-[A-Za-z0-9]{32,}`, `-----BEGIN (RSA \|EC \|OPENSSH \|PGP )?PRIVATE KEY-----`, `eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}`, generic `(api[_-]?key\|secret\|password\|passwd\|token)\s*[:=]\s*['"][^'"]{8,}['"]` (case-insensitive). Also flag any changed file named `.env` or `.env.*` (not `.env.example`). | flag |
| 4 | Source changed, no tests changed | source = files matching `\.(ts\|tsx\|js\|jsx\|mjs\|py\|go\|rb\|rs\|java\|kt\|swift\|php\|cs)$` that are not tests. tests = path matches `\.(test\|spec)\.[a-z]+$`, `/__tests__/`, `/tests?/`, `_test\.go$`, `/test_[^/]+\.py$`, `Spec\.[a-z]+$`. warn if source count > 0 and test count = 0. pass if no source files changed (docs/config-only PR). | warn |
| 5 | Debug leftovers | added lines matching `console\.(log\|debug\|trace)\(`, `\bdebugger\b`, `binding\.pry`, `byebug`, `\bdd\(`, `var_dump\(`, and `^\s*print\(` in `.py` only. Skipped in test files. | warn |
| 6 | Lockfile drift | pairs: `package.json` ↔ any of `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `bun.lock`, `bun.lockb`; `pyproject.toml` ↔ `poetry.lock`, `uv.lock`; `Cargo.toml` ↔ `Cargo.lock`; `go.mod` ↔ `go.sum`; `Gemfile` ↔ `Gemfile.lock`. warn when the manifest changed and its hunk text touches `dependencies`, `devDependencies`, `peerDependencies`, `[dependencies]`, `require`, or `gem ` but no paired lockfile changed. Lockfile changed without manifest is info (pass with a note). Lockfiles are exempt from the ignore list for this check only. | warn |

Checklist never blocks the submit button. It informs. A finding can be ticked off; ticks persist per `owner/repo/range` in `chrome.storage.local` for 7 days.

## Screens (names only)

1. Badge (collapsed panel, counts of flag/warn)
2. Checklist panel (expanded, six rows, expandable items, tick boxes, "copy as markdown")
3. Options page (thresholds, ignore globs, enable/disable per check)
4. Popup (status line, link to options, link to open a compare page)
5. Error/empty states inside the panel (fetch failed, diff too large, no changes)

## Chunks (each a shippable vertical slice)

### Chunk 1: Mount and diff stats
CRXJS scaffold, manifest, content script on both URL patterns, Shadow DOM host, URL parser, `.diff` fetch, `parse-diff`, panel shows range + files/additions/deletions. Logged-in spike to confirm `#pull_request_title` / `#pull_request_body` ids. Ships alone as a diff-stats badge. Done when: loading any compare page shows correct file/line counts that match GitHub's own diffstat.

### Chunk 2: Six checks and the checklist
`src/lib/checks/*.ts`, one file per check, `runChecks(files, config): Finding[]`, Vitest fixtures for each check (positive and negative). Panel renders pass/warn/flag rows with expandable items. A stranger sees the full value here. Done when: the six checks fire correctly on a fixture branch that plants one violation each, and pass on a clean docs-only branch.

### Chunk 3: Settings, persistence, copy as markdown
Options page bound to `chrome.storage.sync` (thresholds, ignore globs, per-check toggle). Tick state per range in `chrome.storage.local`. "Copy as markdown" produces a checklist block with a one-line "via PR Preflight" footer; if `#pull_request_body` exists offer "insert into description". Done when: changing a threshold re-runs checks without reload; ticks survive a reload.

### Chunk 4: Resilience
Turbo navigation: re-run on `turbo:load`, `popstate`, and branch-switch (URL change observer), tear down and remount. Size cap 2 MB on the `.diff` response; above it, show "diff too large" as a flag and skip content checks. DOM fallback parser behind the same `DiffFile[]` type. Error and empty states. GitHub Enterprise domains explicitly out of scope (`## later`). Done when: swapping base branch in the compare dropdown updates the panel without a reload, and killing the `.diff` fetch in devtools still yields findings from the DOM.

### Chunk 5: Store packaging and launch assets
Icons, 1280x800 screenshots on a planted-violation branch, `STORE_LISTING.md`, privacy statement ("no data leaves github.com"), README with a GIF, zip via `vite build`. Submit to the Chrome Web Store. Show HN draft and r/webdev variant in `marketing/`. Done when: the store submission is in review and the repo README explains install-from-zip for the wait.

## Later

- BYOK Claude summary (opt-in, 3-bullet risk summary). Deferred from v1 on purpose: adds `host_permissions` for `api.anthropic.com`, a privacy policy requirement, and a longer store review. Candidate for v1.1 after the listing is live.
- GitHub Enterprise custom domains via `optional_host_permissions`.
- GitLab merge request creation page.
- Repo-level config `.prpreflight.json` for team thresholds.
- Extra checks: large binaries added, `.only(` in tests, merge-conflict markers, commented-out code blocks.
- Firefox port.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| GitHub migrates the compare page to the React diff DOM (the PR "Files changed" page already did, default since Jan 2026) | Primary source is the `.diff` URL, which is a stable public URL scheme. DOM is fallback only and lives in one `selectors.ts`. Shadow DOM mount depends on `body` only. |
| `.diff` endpoint fails: huge compare, rate limit, network | 2 MB cap surfaces "diff too large" as a finding. DOM fallback for everything else. Errors render inside the panel, never a blank host. |
| Turbo/SPA navigation leaves a stale panel | Chunk 4: listen to `turbo:load` and URL changes, full teardown and remount. |
| False positives in secret and debug regexes (fixtures, docs) | Default ignore globs, per-check toggles, path shown on every item, and the checklist never blocks submission. |
| Store review latency for a `github.com` host permission | Submit at the end of chunk 5 on Saturday if possible. Only `storage` permission, one host, no remote code, plain-language justification. README carries a load-unpacked path for the wait. Prior extension cleared review inside the same week. |
| Thin moat: Refined GitHub adds diff checks | Ship first, single-purpose listing ranks for "PR checklist". Position as complementary to Refined GitHub in the README. |
| Privacy perception on private repos | No network calls except same-origin `github.com`. Say it in the listing, popup, and README. |

## Distribution

1. Chrome Web Store listing, keywords: "github pull request checklist", "PR self review", "pre-submit".
2. Show HN: "PR Preflight: a self-review checklist on GitHub's compare page, no API key". Backup: r/webdev and r/github with the same GIF.
