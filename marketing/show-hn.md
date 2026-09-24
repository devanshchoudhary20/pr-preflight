# Show HN draft

**Title** (68 chars, under the 80 limit):

```
Show HN: A self-review checklist on GitHub compare pages, no API key
```

**Post when:** the day the Chrome Web Store approves the listing (one-click install). Tue-Thu, ~8-9am ET.

---

**First comment:**

I built a Chrome extension that runs a self-review checklist on GitHub's compare page (`/compare`, `/pull/new`), before the PR exists.

Why author-side, not reviewer-side: every GitHub review tool I found (GitBrief, PR Checklistify, a handful of AI reviewer extensions) works on an open pull request, after a reviewer is already looking at it. None of them read the diff earlier, at the point where the author is still deciding whether to open the PR. That's the moment a leftover `console.log` or an untested change is cheapest to fix, so that's where I put the checklist.

What it checks: diff size, leftover TODO/FIXME markers, likely secret patterns (AWS keys, GitHub tokens, private key headers, JWTs, and a generic `key=`/`secret=` pattern), source files changed with no test file changed, debug leftovers (`console.log`, `debugger`, `binding.pry`, `byebug`), and lockfile drift (manifest changed, lockfile didn't). All six are regex or structural rules over the parsed diff.

What it does not do:
- No LLM, no bundled model, no BYOK key. Every check is deterministic.
- No data leaves `github.com`. The only network call is the same-origin `.diff` GitHub already serves for that compare; there's no other host permission in the manifest.
- Doesn't block the "Create pull request" button. It's a checklist, not a gate.

It mounts as a small badge bottom-right (Shadow DOM, so GitHub's CSS never leaks in and mine never leaks out) and expands into the six-row panel on click.

Feedback I want most: is the six-check set the right starting list, or is there an obvious seventh check (I'm eyeing merge-conflict markers and commented-out code blocks next)? And does "before the PR exists" actually change your review behavior, or is it the same checklist you'd run on the open PR anyway?

Open source (MIT): https://github.com/devanshchoudhary20/pr-preflight
