# Client Assistant

Claude Code skill for setting up persistent AI assistant personas on client projects.

## What It Does

Run `/client-assistant` in any client project folder and a wizard walks you through creating:

- A named AI persona (e.g. "Archie") that loads automatically every session
- `CLAUDE.md` with persona config, communication rules, and client context
- Interaction log for tracking emails, calls, and meetings
- Deliverables tracker for managing project status

Your personal info (name, email, company) is saved on first run so you never enter it again.

## Install

This skill ships bundled with **Airport Authority** — no separate install needed.

## Usage

```
/client-assistant        # Run the setup wizard
/client-assistant intro  # Draft + send intro email to client
```

### Wizard Steps

1. **Principal config** (first run only) -- your name, email, company
2. **The basics** -- assistant name, client company, contact info, tone
3. **Project context** -- engagement description, live assets
4. **Generate files** -- CLAUDE.md, interaction log, deliverables tracker
5. **Optional** -- send an intro email to the client

## Files Created

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Persona + project rules (auto-loads every session) |
| `memory/MEMORY.md` | Client context summary |
| `memory/client-interactions.md` | Email/call/meeting log |
| `memory/deliverables-tracker.md` | Deliverable status tracking |

## Team Usage

Each team member's principal info is stored locally in `~/.claude/client-assistant-config.json` -- no personal data in the skill itself.

## License

MIT
