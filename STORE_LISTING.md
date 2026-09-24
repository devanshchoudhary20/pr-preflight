# Chrome Web Store — Listing Copy

Paste-ready copy for the [Developer Dashboard](https://chrome.google.com/webstore/devconsole).

---

## Name (max 75 chars)

```
PR Preflight — self-review checklist for GitHub
```

## Summary (max 132 chars)

```
Run six diff checks on GitHub's compare page before you open the PR. No API key, no data leaves github.com.
```

## Category

`Developer Tools`

## Language

`English`

---

## Description (max 16,000 chars)

```
You already review your own diff before opening a PR. PR Preflight does the mechanical part of that pass for you, right on GitHub's compare page, before the PR even exists.

★ SIX CHECKS, NO SETUP
Diff size, leftover TODO/FIXME markers, likely secret patterns (AWS keys, GitHub tokens, private key headers, and more), source changes with no test changes, debug leftovers (console.log, debugger, binding.pry), and lockfile drift. Every check runs the moment you land on a compare or new-PR page.

★ BEFORE THE PR EXISTS
Every other GitHub review tool works on an open pull request, after a reviewer is already looking at it. PR Preflight reads the same diff earlier, on /compare and /pull/new, so you catch the obvious stuff before anyone else sees it.

★ NO API KEY, NO ACCOUNT
Every check is a plain regex or a structural rule over the parsed diff. No LLM, no bundled model, no sign-in, no rate limit.

★ NOTHING LEAVES GITHUB.COM
The only network request is the same-origin .diff GitHub already serves for that compare. No third-party host, no analytics, no remote code.

★ SETTINGS THAT STICK
Adjust the warn/flag thresholds, add your own ignore globs, or turn off a check you don't want, from the options page. Checked-off items persist per branch for a week so you don't re-triage the same finding twice.

— HOW IT WORKS —
Open a compare or new-PR page. A small badge appears bottom-right showing the worst finding at a glance. Click it to expand the full checklist, six rows, expandable items, path and line for each hit.

— GOOD TO KNOW —
Findings never block the "Create pull request" button. This is a checklist, not a gate. The secrets check never shows the matched text, only the pattern name, so a screenshot of the panel is safe to share.

Open source: https://github.com/devanshchoudhary20/pr-preflight
```

---

## Single purpose (required field)

```
This extension has one purpose: to run a fixed set of author-side diff checks (size, leftover markers, likely secrets, missing tests, debug statements, lockfile drift) on a GitHub compare or new-PR page and show the results in an on-page panel.
```

---

## Permission justifications (required, per-permission)

`**storage**`

```
Stores the user's check thresholds, ignore globs, and per-check toggles (chrome.storage.sync), plus which findings have been ticked off per branch, kept for 7 days (chrome.storage.local). Nothing here is transmitted anywhere.
```

`**activeTab**`

```
Reads the active tab's URL when the popup opens, so the popup can tell whether the current tab is a GitHub compare page and show its status. No tab content is read.
```

**Host permission: `https://github.com/*`**

```
Injects the checklist panel on GitHub compare and new-PR pages, and fetches the same-origin .diff for that compare so the checks run on the real diff instead of scraping the rendered DOM.
```

---

## Privacy practices (Data usage disclosures)

- **Does this item collect or use user data?** No.
- **Personally identifiable information:** Not collected.
- **Health / financial / authentication / personal communications / location / web history / user activity:** Not collected.
- Check all three compliance certifications:
  - [x] I do not sell or transfer user data to third parties (outside approved use cases).
  - [x] I do not use or transfer user data for purposes unrelated to my item's single purpose.
  - [x] I do not use or transfer user data to determine creditworthiness or for lending.

**Privacy policy URL**

```
https://github.com/devanshchoudhary20/pr-preflight/blob/main/PRIVACY.md
```

---

## Screenshots (1280x800, capture on a planted-violation branch)

- [ ] Badge on a compare page (collapsed, showing a worst-severity dot and count)
- [ ] Expanded panel with findings (six rows, at least one flag and one warn visible)
- [ ] Expanded row (one check's item list open, path:line and snippet visible)
- [ ] Options page (thresholds, ignore globs, per-check toggles)
- [ ] Popup (status line for the active compare tab)

---

## Pre-submission checklist

- `npm run build`, `npm run lint`, `npm test`, `npm run package` all exit 0.
- Zip built from `dist/`, `manifest.json` at the archive root, no source maps.
- 128×128 store icon exported (`npm run icons`, from `assets/icon.svg`).
- 5 screenshots captured at 1280×800 (see checklist above).
- `PRIVACY.md` reachable at the URL above.
- Submission itself is a human gate, not automated by this repo.
