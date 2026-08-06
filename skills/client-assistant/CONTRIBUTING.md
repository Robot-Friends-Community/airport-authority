# Contributing to Client Assistant

Thanks for your interest! Client Assistant is a Claude Code skill for setting up persistent AI personas on client projects.

## Getting Started

1. Fork the repo
2. Clone your fork to `~/.claude/skills/client-assistant/`
3. Test in a real Claude Code session in a project folder
4. Open a PR

## Testing Changes

1. Run `/client-assistant` in an empty test project folder
2. Complete the full wizard (all 4 steps)
3. Verify all expected files are created: CLAUDE.md, memory/MEMORY.md, memory/client-interactions.md, memory/deliverables-tracker.md
4. Start a new session in the same folder — confirm the persona loads from CLAUDE.md
5. Test `/client-assistant intro` — verify email draft appears for approval before sending

## Edge Cases to Test

- First run (no ~/.claude/client-assistant-config.json exists)
- Subsequent run (config file exists — should skip Step 0)
- Running in a folder that doesn't look like a project folder (should warn)

## Commit Messages

- `feat:` — New feature
- `fix:` — Bug fix
- `docs:` — Documentation only
- `refactor:` — Restructuring without behavior change

## Issues

Include: what step failed, what project folder context you were in, what you expected vs. what happened.
