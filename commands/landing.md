---
name: landing
description: Resume work from previous session handoff (smooth landing into a new session)
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
  - Skill
---

<command-name>landing</command-name>

<objective>
Restore complete project context from `FLIGHT-LOG.md` (or legacy `HANDOFF-ALLEYOOP.md`) and suggest the next action to continue work.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/skills/flight-deck/SKILL.md
</execution_context>

<process>

<step name="locate-handoff">
**Find handoff file in priority order:**

1. `FLIGHT-LOG.md` in current directory
2. `FLIGHT-LOG.md` in git root
3. `HANDOFF-ALLEYOOP.md` in current directory (legacy)
4. `HANDOFF-ALLEYOOP.md` in git root (legacy)
5. GSD: `.planning/phases/*/.continue-here.md` (most recent)

```bash
# Check current dir (new name first, then legacy)
test -f FLIGHT-LOG.md && echo "found:FLIGHT-LOG.md"
test -f HANDOFF-ALLEYOOP.md && echo "found:HANDOFF-ALLEYOOP.md"

# Check git root
GIT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
test -f "$GIT_ROOT/FLIGHT-LOG.md" && echo "found:$GIT_ROOT/FLIGHT-LOG.md"
test -f "$GIT_ROOT/HANDOFF-ALLEYOOP.md" && echo "found:$GIT_ROOT/HANDOFF-ALLEYOOP.md"

# Check for GSD continue files
ls -t .planning/phases/*/.continue-here.md 2>/dev/null | head -1
```

**If not found:**
- Ask user if they want to start fresh or look elsewhere
- Offer to check recent projects in your workspace root (e.g. `~/projects/`)
</step>

<step name="detect-unclean-exit">
**Check whether the previous session ended cleanly. If not, enter Recovery mode FIRST.**

The normal resume trusts that the handoff + recorder describe reality. After a crash /
accidental `/exit` / a session that never ran `/takeoff`, they don't — the repo moved but
the durable memory froze. Detect the **unclean-exit fingerprint** (any one is enough):

```bash
GIT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
# 1) explicit warning flag dropped by the recorder hook
test -f "$GIT_ROOT/.flight-recorder-warning.json" && echo "unclean:warning-file"
# 2) repo moved but recorder didn't — newest commit newer than the newest recorder entry
git -C "$GIT_ROOT" log -1 --format=%cd --date=iso
# (compare against the date of the last FLIGHT-RECORDER.md entry)
# 3) handoff older than HEAD
```

Also enter Recovery mode if the user explicitly says they crashed / exited by accident /
"recover" / "pick up after a crash".

**If the fingerprint is present → follow the skill's `references/RECOVERY.md`**
(establish last known-good → place the crash on the git timeline → classify untracked files
by MTIME → validate surviving media → recover unsaved deliverables → reconstruct the missing
recorder entry via `/takeoff`), THEN continue the normal landing below.

**If it ended cleanly → skip this step** and resume normally.
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

<step name="check-flight-recorder">
**Check for Flight Recorder:**

If `FLIGHT-RECORDER.md` exists, read the last 1-2 entries to provide additional context. Note:
```
Flight Recorder: [N] sessions recorded
```
</step>

<step name="surface-bible-tome">
**Surface durable memory + check for front-page drift — execute RESUME.md §2.6.**

Detect the same surfaces (`TOME.md` at root; `.bible-keeper.json` / `BIBLE*.md` depth ≤3).

- **Front-page drift check (recorder-relative):** if `TOME.md` exists, compare its **Current Session** marker (session number / date on the front page) against the newest `FLIGHT-RECORDER.md` entry. If the Tome front page lags → surface **"⚠️ Tome front page STALE — N behind the recorder"** so it gets reconciled at the next `/takeoff` (`/canon-keeper takeoff`).
- **Reality probe (catches the frozen-BOTH case — the recorder can be stale too):** the check above misses the worst case — a whole session closed with **no** `/takeoff`, so the recorder AND the Tome are both frozen while the repo moved. So also compare the Tome front-page date against **repo reality**: recent `git log` and any beads closed since that date (`git log --since`, `bd list --status=closed`). If commits/beads advanced but **no** memory surface did → surface **"⚠️ Tome front page STALE — session closed without a /takeoff (repo moved, memory didn't)"**.
- On a **keeper project** (`TOME.md` present), recommend **`/canon-keeper landing`** as the richer, Tome-first resume.
- If a **Bible** exists, note its freshness.
- If **none exist but the project warrants one** (CLAUDE.md + real multi-session / ecosystem build), stage a one-line create nudge (don't force).
</step>

<step name="present-summary">
**Display restoration summary.** Left-anchored under fixed `═`/`─` rules; emojis as section markers; no right border (emoji misalign it); omit any section that doesn't apply. See RESUME.md §4 for the full conventions.

```
🛬 ═══════════════ SESSION RESTORED ═══════════════   (as [user])

  📍 [project] · [abs project root] · [branch, if a repo]

  📋 Objective   [objective]
  📊 Progress    [X]% · [completed]/[total] items
  🕒 Handoff     [timestamp]

  ⏳ Remaining
     ☐ [Item 1]
     ☐ [Item 2]

  🧠 Decisions preserved
     • [Decision 1]
     • [Decision 2]

  🚧 Blockers    [None | list with status]
  📼 Recorder    [N] entries · Lenses: [Technical, Journey, Patterns]
  📖 Bible / Tome   [status · ⚠️ front page N behind recorder]   ← omit if n/a
  ─────────────────────────────────────────────
  🔄 Since handoff   [new commits / file changes]   ← only if state changed
═══════════════════════════════════════════════════
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
  ➡️  Suggested next   [specific action]

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
- [ ] Handoff file located and parsed (FLIGHT-LOG.md or legacy HANDOFF-ALLEYOOP.md)
- [ ] Complete context restored
- [ ] User understands current state
- [ ] Specific next action suggested
- [ ] User ready to continue
</success_criteria>
