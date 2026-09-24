# Project rules (ANBU)

This is a personal weekend product built through `/mission`. Global `~/.claude/CLAUDE.md` applies. The company-specific parts (cerebrum, `/contract`, Jira) do not.

- Mission state and artifacts live in `.anbu/`. Read `.anbu/plan.md` for the acceptance line and `.anbu/screens.md` for every screen's states before touching UI.
- Reuse before create. Grep by behavior first.
- No logic in JSX. Components under 400 lines. Single-line comments, only for a why.
- Every value from an API, storage, or the user has the fallback named in the screens file. Nothing renders undefined, null, NaN, or an empty string.
- No secrets in client code. Only public write-only keys reach a bundle.
- Extensions: Vite + CRXJS, MV3. Web: Vite static first, Next.js only for server routes.
- Commit per chunk as `feat(<chunk>): <what a stranger can now do>`. Never push to a store or post publicly; that is the launch gate.
