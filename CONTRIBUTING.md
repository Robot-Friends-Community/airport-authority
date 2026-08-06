# Contributing to Airport Authority

Thanks for helping out! Airport Authority is a Claude Code **plugin** — a bundle of
skills (markdown instruction files), slash commands, and a few small, dependency-free
Node hook scripts. No build step, no runtime dependencies.

## Layout

```
airport-authority/
├── .claude-plugin/
│   ├── plugin.json         # plugin manifest
│   └── marketplace.json    # lets the repo be added as a one-plugin marketplace
├── skills/<skill>/SKILL.md # 13 skills, each self-contained
├── commands/<name>.md      # 7 slash commands
├── hooks/
│   ├── hooks.json          # hook wiring (SessionStart / SessionEnd / PreCompact / Stop)
│   ├── *.js                # the hook scripts (plain Node, zero deps)
│   └── lib/                # shared helpers
├── assets/                 # README images
└── README.md
```

## Development setup

The fastest loop is to install the plugin from your local checkout and try it in a
throwaway project:

```
/plugin marketplace add /absolute/path/to/your/airport-authority
/plugin install airport-authority
```

Then exercise the commands (`/takeoff`, `/landing`, `/tower`, `/airport`,
`/flight-engineer`) and confirm the hooks fire on session start/end and compaction.

## Conventions

- **Hooks stay zero-dependency ESM Node.** They must write session state only to the
  user-global, namespaced state location — never to the plugin directory (it may be
  read-only) and never to a shared world-writable path.
- **Skills degrade gracefully.** If an optional external tool (`dopa`, `codex`, `op`,
  `continuous-learning-v2`, `case-study`) is absent, the skill must no-op cleanly, not
  error.
- **Merges and deploys stay human.** Anything that publishes (push, PR, Slack, deploy)
  is surfaced in plain language and gated on explicit confirmation.
- **Keep it portable.** No hardcoded personal paths, no assumptions about one specific
  GitHub org. This plugin is meant to work for anyone.

## Branch flow

```
main  ←  feature/*
```

Branch off `main`, one concern per branch, open a PR. (GitHub Free doesn't enforce
branch protection, so this is a convention — please follow it.) Add a `CHANGELOG.md`
entry under `## [Unreleased]`.

By contributing you agree your work is licensed under the project's
[MIT License](LICENSE), and you agree to follow our [Code of Conduct](CODE_OF_CONDUCT.md).
