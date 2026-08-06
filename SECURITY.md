# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Email **richard@404notfound.red** with details and steps to reproduce. We aim to acknowledge within a few days and will coordinate a fix before any public disclosure. We ask for up to a **90-day** window before details are made public.

## Scope notes

Airport Authority is a Claude Code plugin: a bundle of skills (markdown instructions), slash commands, and a handful of small Node hook scripts. It runs locally inside your Claude Code session.

- The hooks (`hooks/*.js`) are plain Node with no runtime dependencies. They read and write session-continuity state to a user-global, namespaced location under your home `.claude` directory — never to a world-writable path, and never to the plugin directory itself.
- The skills operate on files in your own project (handoff logs, a build recorder, project docs) and shell out to tools you already have installed (`git`, `gh`, and — if present — optional helpers like `dopa`, `codex`, and `op`). Anything not installed is treated as absent and skipped.
- No hook or skill transmits your code or data off-machine on its own. Actions that publish or send anything (a `git push`, opening a PR, a Slack message) are surfaced in plain language and gated on your confirmation; merges and deploys are always human-approved.

Reports about a hook writing outside its intended state location, a command running without the confirmation it claims, or any command-injection surface are especially welcome.
