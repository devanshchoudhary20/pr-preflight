# Reddit drafts

Check each sub's self-promotion rule before posting (both r/webdev and r/github gate promo posts behind a karma minimum, a flair, or a fixed weekly thread, and this changes without notice). Post the day the store listing goes live so the link is live; engage in the comments instead of dropping the link and leaving.

---

## r/webdev

**Self-promo check:** r/webdev restricts self-promotion to the pinned "Showoff Saturday" thread for most accounts — confirm the current thread exists before posting standalone, or use it as a top-level comment there instead.

**Title:** I built a Chrome extension that runs a self-review checklist on GitHub's compare page, before the PR exists

**Body:**

Every GitHub review extension I could find works on an open PR, for the reviewer. I wanted something earlier: a checklist on `/compare` and `/pull/new`, for the author, before anyone else sees the diff.

It runs six checks against the real diff (fetched from the same-origin `.diff` URL GitHub already serves, not scraped from the DOM): diff size, leftover TODO/FIXME, likely secret patterns, source changes with no test changes, debug leftovers (`console.log`, `debugger`), and lockfile drift. No LLM, no API key, nothing leaves `github.com`.

It mounts as a small badge in a Shadow DOM host so it can't clash with GitHub's own styles, and expands into a panel on click. Findings never block submitting the PR, they just tell you what to look at.

Repo: https://github.com/devanshchoudhary20/pr-preflight · Store: [link pending review]

Curious what checks people here would add first.

---

## r/github

**Self-promo check:** r/github doesn't have a blanket self-promo ban but moderators do remove low-effort "I made a thing" posts with no discussion; lead with the technical decision, not the pitch.

**Title:** Reading a GitHub compare page's diff without a reviewer-side extension or an API key

**Body:**

Wanted to share a decision I made building a self-review checklist for GitHub compare pages: instead of scraping the rendered DOM (which GitHub is mid-migration on, the PR "Files changed" page already moved to a React-rendered diff), I fetch `https://github.com/<owner>/<repo>/compare/<range>.diff` directly. It's the same-origin, cookie-authenticated, plain-text unified diff GitHub has served for years, and it works identically whether the DOM is the old Rails view or the new React one. DOM scraping is only a fallback if that request fails or the diff is over a 2 MB cap.

Built this into an extension (PR Preflight) that runs six checks on that diff before you open the PR: size, TODO/FIXME, secret patterns, missing tests, debug leftovers, lockfile drift. No API key, no data leaves `github.com`.

Repo: https://github.com/devanshchoudhary20/pr-preflight

Happy to talk through the `.diff`-vs-DOM tradeoff if anyone's building something similar.
