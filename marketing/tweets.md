# Tweet drafts

## 1 — the hook

Your PR self-review checklist, run on GitHub's compare page, before you even open the PR.

No API key. No data leaves github.com. Just six checks on the real diff.

[Chrome Web Store link]

## 2 — the gap

Every GitHub review extension I found works on an already-open PR, for the reviewer.

None of them read the diff earlier, when you're still deciding whether to open it — the cheapest moment to catch a leftover console.log or a missed test.

So I built one that does. [link]

## 3 — the mechanics

How PR Preflight reads your diff: it fetches the same `.diff` URL GitHub already serves for a compare, same-origin, cookies included. No scraping, no API key, no remote server.

Six checks run on that diff, right in a badge on the page. [link]
