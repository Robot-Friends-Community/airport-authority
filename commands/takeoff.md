---
name: takeoff
description: Create context handoff before clearing context (prepare for takeoff)
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
---

<command-name>takeoff</command-name>

<objective>
Create `FLIGHT-LOG.md` in project root to preserve complete work state before clearing context.

Enables seamless resumption with `/landing` (or `/slamdunk`) in a fresh session.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/skills/flight-deck/SKILL.md
</execution_context>

<process>

<step name="locate-project">
**Find project root:**

```bash
git rev-parse --show-toplevel 2>/dev/null || pwd
```

Use this as the target directory for FLIGHT-LOG.md.
</step>

<step name="detect-scaffolding">
**Check for active scaffolding systems:**

```bash
# GSD
test -f .planning/STATE.md && echo "gsd"

# Planning with files
test -f task_plan.md && echo "planning-files"

# Project log
test -f PROJECT_LOG.md && echo "project-log"
```

Store detected type for later.
</step>

<step name="gather-git-state">
**Capture uncommitted changes:**

```bash
git status --porcelain 2>/dev/null || echo "Not a git repo"
git log -1 --oneline 2>/dev/null || echo "No commits"
```
</step>

<step name="gather-scaffolding-state">
**If GSD detected:**
- Read `.planning/STATE.md` for current phase/task
- Check for `.planning/phases/*/.continue-here.md`
- Note current milestone and phase number

**If planning-files detected:**
- Read `task_plan.md` for current status
- Note checked/unchecked items

**If project-log detected:**
- Read latest entry from `PROJECT_LOG.md`
</step>

<step name="gather-session-context">
**Collect from current session:**

1. **Objective** - What are we trying to accomplish?
2. **Completed** - What got done this session?
3. **Remaining** - What's left to do?
4. **Decisions** - Key choices made and why?
5. **Blockers** - Anything stuck or problematic?
6. **Next action** - Specific first thing to do when resuming?

**If any of these are unclear**, ask the user to clarify.
</step>

<step name="write-handoff">
**Write FLIGHT-LOG.md to project root:**

```markdown
---
project: [folder name]
timestamp: [ISO 8601]
scaffolding: [gsd | planning-files | project-log | none]
---

# Session Handoff

## Objective
[What we're trying to accomplish - be specific]

## Progress
**Status:** [X]% complete | [phase info if applicable]

### Completed
- [x] [Item 1]
- [x] [Item 2]

### Remaining
- [ ] [Item 3]
- [ ] [Item 4]

## Key Decisions
- **[Decision]**: [Rationale]

## Blockers
[None | list blockers with status]

## Uncommitted Changes
```
[git status output]
```

## Scaffolding State
[GSD: Phase X, Task Y of Z]
[Planning: Phase 2 of 4 complete]
[Or: None]

## Next Action
**Start with:** [Specific, actionable first step]

## Context Notes
[Mental state, approach, anything the next session needs to know]
```
</step>

<step name="flight-recorder">
**Check for Flight Recorder configuration:**

If `.flight-recorder.yml` exists and `enabled: true`:
1. Read config for default mode and active lenses
2. Check if `/takeoff debrief` was invoked (override to debrief mode)
3. Check for debrief auto-trigger signals (suggest escalation if detected)
4. Extract session data according to active mode
5. Append entry to `FLIGHT-RECORDER.md`
6. **Reconcile** `session_count` in `.flight-recorder.yml` to the ACTUAL number of entries in `FLIGHT-RECORDER.md` (count the entry delimiters), not a blind `+1` — a blind increment silently drifts whenever a prior session bypassed this step.

If `.flight-recorder.yml` doesn't exist:
- Offer to set up the Flight Recorder (see Setup Wizard in SKILL.md)
- If declined, proceed with handoff-only

**After writing a Flight Recorder entry**, update the central index (if one is configured):
- Resolve `central_index_path` from `.flight-recorder.yml` or the flight-deck `config.yml`; if it resolves to an `INDEX.md`, use it. If no central index is configured, skip this — it's optional.
- Find/update the row for the current project (or add a new row)
- Update session count and last entry date
</step>

<step name="bible-tome-sync">
**Keep durable memory current — execute HANDOFF.md §3.6 (Bible / Tome Sync).** A Tome or Bible is a durable memory surface exactly like the Flight Recorder, so takeoff keeps it current with the **same always-on posture** — not an opt-in prompt.

Detect the surfaces in the project:

```bash
test -f TOME.md && echo "tome"                 # root Keeper's Tome (canon-keeper)
test -f .bible-keeper.json && echo "bible-cfg" # Bible config
ls BIBLE*.md */BIBLE*.md **/BIBLE*.md 2>/dev/null | head   # Bibles (depth ≤3)
```

- **If `TOME.md` present →** run `/canon-keeper takeoff` — it refreshes the Tome **front page** (Current Session / Open Threads / Next action / Known Drift) **and** appends TOME-LOG history. **NEVER `/canon-keeper log`** (append-only — leaves the front page to rot). **Skip** if this session was already closed via `/canon-keeper takeoff`.
- **If a Bible is present →** run the `/bible-keeper` batch scan to log this session's decisions/state.
- **If both →** Bible first, then the Tome.
- **If NEITHER but the project warrants one** (has a CLAUDE.md and is a real multi-session / ecosystem build) **and a keeper wasn't previously declined →** OFFER to create one (default **N**; never force).

**Record the outcome** (synced / already-done-this-session / offered→created / declined / not-appropriate / not-configured) — it must surface in the Postflight banner, never be silently skipped.

**🚩 RED FLAG:** if the Flight Recorder got a fresh entry this session but `TOME.md`'s Current-Session marker did **not** advance, the Tome front page is drifting behind the recorder — say so explicitly and run `/canon-keeper takeoff` to reconcile before declaring SAFE TO /clear.
</step>

<step name="confirm">
**Display confirmation.** The `🧹 SAFE TO /clear` banner is shown **only when every configured system verified**. If any durable write failed, show the ⛔ banner instead and name the fix — never tell the user it's safe to clear when state didn't persist. Full spec + the INCOMPLETE variant in HANDOFF.md §7.

**Verified complete:**
```
🛫 ═══════════════ TAKEOFF COMPLETE ═══════════════

  📍 [project] · [abs project root] · [branch, if a repo]

  ✅ Flight log      FLIGHT-LOG.<user>.md
  ✅ Flight Recorder Entry #N appended ([mode])   ← omit if not configured
  ✅ Bible / Tome    [front page refreshed + log appended]   ← omit if not configured

  📋 Objective   [brief]
  📊 Progress    [X]% · [completed]/[total] items
  ➡️  Next        [action]

  ─────────────────────────────────────────────
  🧹 SAFE TO /clear  —  your full state is saved.
     Resume anytime with  /landing  (or /slamdunk)
═══════════════════════════════════════════════════
```

**If any system failed (TAKEOFF INCOMPLETE):**
```
🛫 ═══════════════ ⛔ TAKEOFF INCOMPLETE ═══════════

  ✅ Flight log      FLIGHT-LOG.<user>.md
  ⛔ [system]        [what failed]

  ─────────────────────────────────────────────
  ⛔ DO NOT /clear yet  —  [system] did not save.
     Fix: [manual fix], then re-run /takeoff.
═══════════════════════════════════════════════════
```
</step>

</process>

<success_criteria>
- [ ] FLIGHT-LOG.md created in project root
- [ ] All sections filled with specific content
- [ ] Next action is immediately actionable
- [ ] Flight Recorder entry appended (if configured)
- [ ] User knows how to resume
</success_criteria>
