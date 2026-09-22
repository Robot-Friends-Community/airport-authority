---
name: slamdunk
description: Alias for /landing — resume work from previous session handoff
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
  - Skill
---

<command-name>slamdunk</command-name>

<objective>
Restore complete project context from `FLIGHT-LOG.md` (or a Baggage Claim `BAGGAGE.md` / legacy `HANDOFF-ALLEYOOP.md`) and suggest the next action to continue work.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/skills/flight-deck/SKILL.md
</execution_context>

<process>

<step name="locate-handoff">
**Find handoff file in priority order:**

1. `FLIGHT-LOG.md` in current directory
2. `FLIGHT-LOG.md` in git root
3. `BAGGAGE.md` in current directory (Baggage Claim — the beginner edition; upgrading users land here)
4. `BAGGAGE.md` in git root
5. `HANDOFF-ALLEYOOP.md` in current directory (legacy no-look-pass)
6. `HANDOFF-ALLEYOOP.md` in git root (legacy)
7. GSD: `.planning/phases/*/.continue-here.md` (most recent)

```bash
# Same order as the list above; the FIRST hit wins (GSD's continue file is the last resort).
# Outside a git repo GIT_ROOT falls back to the cwd, never the filesystem root.
GIT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
GSD=$(ls -t .planning/phases/*/.continue-here.md 2>/dev/null | head -1)
for f in FLIGHT-LOG.md "$GIT_ROOT/FLIGHT-LOG.md" \
         BAGGAGE.md "$GIT_ROOT/BAGGAGE.md" \
         HANDOFF-ALLEYOOP.md "$GIT_ROOT/HANDOFF-ALLEYOOP.md" \
         "${GSD:-/dev/null/none}"; do
  test -f "$f" && echo "found:$f" && break
done
```

**If not found:**
- Ask user if they want to start fresh or look elsewhere
- Offer to check recent projects in your workspace root (e.g. `~/projects/`)
</step>

<step name="read-handoff">
**Parse handoff file:**

Extract:
- `project` - Project name
- `timestamp` - When handoff was created
- `scaffolding` - Active scaffolding type
- Objective
- Progress (percent, completed/remaining items)
- Key decisions
- Blockers
- Next action
- Context notes
</step>

<step name="check-current-state">
**Verify state hasn't changed:**

```bash
git status --porcelain 2>/dev/null
git log -1 --oneline 2>/dev/null
```

If significant changes since handoff, note them.
</step>

<step name="present-summary">
**Display restoration summary:**

```
Session Restored

Project: [name]
Handoff from: [timestamp]

Objective: [objective]

Progress: [X]% complete | [completed]/[total] items

Remaining:
- [ ] [Item 1]
- [ ] [Item 2]

Key Decisions Preserved:
- [Decision 1]
- [Decision 2]

Blockers: [None | list with status]

[If changes since handoff:]
Changes since handoff:
- [new commits, file changes, etc.]
```
</step>

<step name="suggest-next-action">
**Determine suggested action based on context:**

| Condition | Suggestion |
|-----------|------------|
| Blocker exists | "Address blocker: [blocker]" |
| GSD scaffolding | "Continue with `/gsd:progress`" |
| task_plan.md exists | "Continue with next item in task_plan.md" |
| Next action specified | Use the "Next Action" from handoff |
| Otherwise | "Review remaining items and continue" |

**Display:**

```
Suggested next action:
[specific action]

Ready to continue? [Y/n]
```

If user confirms, proceed with the suggested action.
If user declines, ask what they'd like to do instead.
</step>

<step name="cleanup-option">
**After confirming continuation:**

Ask if user wants to delete or archive the handoff:
- Delete the handoff file (work is resuming)
- Keep it (for reference)
- Archive to `.handoff-archive/` with timestamp

Default: Delete after successful resume (it's served its purpose).
</step>

</process>

<gsd-integration>
**If GSD is detected (.planning/ exists):**

Prefer GSD's native resume if `.continue-here.md` is more recent:
- Show GSD state summary
- Suggest `/gsd:resume-work` or `/gsd:progress`
- Note that GSD has its own detailed phase tracking

**If handoff file is more recent:**
- Use handoff file as primary
- Include GSD phase info in summary
</gsd-integration>

<success_criteria>
- [ ] Handoff file located and parsed
- [ ] Complete context restored
- [ ] User understands current state
- [ ] Specific next action suggested
- [ ] User ready to continue
</success_criteria>
