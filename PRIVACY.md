# Privacy

PR Preflight is a Chrome extension. Here is exactly what it reads, where it goes, and what it stores.

## What is read

The diff of the GitHub compare or new-PR page you are currently viewing. The extension fetches `https://github.com/<owner>/<repo>/compare/<range>.diff`, the same-origin URL GitHub already serves for that compare, using your existing GitHub session cookies. Nothing else on the page is read.

## Where it goes

Nowhere. The diff is parsed and checked entirely inside the page, in the content script. PR Preflight makes no request to any host other than `github.com`. No analytics, no error reporting service, no third-party API.

## What is stored

- **Settings** (check thresholds, ignore globs, per-check on/off) in `chrome.storage.sync`, so they follow you across signed-in Chrome installs.
- **Ticked-off findings**, keyed by `owner/repo/range`, in `chrome.storage.local`, kept for 7 days and then discarded.

Both are local to your browser (or your Chrome sync account, for `sync` storage). Neither is sent to a server this extension controls, because it doesn't run one.

## Telemetry

None. No usage tracking, no crash reporting, no remote logging.

## Source

Open source, MIT-licensed: https://github.com/devanshchoudhary20/pr-preflight
