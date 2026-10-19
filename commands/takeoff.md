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
7. **Listeners** - Was anything *polling* this session (a session-bus listener, a Sam-watch,
   a CI/deploy watch)? A `/clear` kills every loop and background task, so the flight log is
   the only thing that can carry it across. Record each one under `## Listeners` (below) with
   its **re-arm command**, so `/landing` restarts it without anyone remembering.

**If any of these are unclear**, ask the user to clarify.
</step>

<step name="capture-open-loops">
**Did this session send a `sidebar` ASK that is still unanswered?**

**Gate:** only if `~/.claude/skills/sidebar/scripts/sidebar.py` exists - `sidebar` is an optional
companion, not a dependency. If absent, skip silently.

Run `python ~/.claude/skills/sidebar/scripts/sidebar.py loops <my-slug>` (`<my-slug>` = this
session's BUS slug, not the `<user>` identity) and record every still-open ask under
`## Open Loops` in the flight log. Only an `ask` creates a loop; a notify or handover does not.
Drop any loop that has since been answered - a closed loop that lingers reads as live.

**An unanswered peer ask must never vanish behind a `🧹 SAFE TO /clear`.**
**Record outcome** for the confirm step: `Open Loops: [N carried | none | sidebar not installed]`.
</step>

<step name="preserve-work">
**Don't lose good work that lives OUTSIDE git. Run HANDOFF.md §5.8 BEFORE git-hygiene** so anything rescued gets
committed in the same pass.

1. **Salvage:** list what this session left in the scratchpad, temp folders and worktrees. Move each KEEP item
   (reusable script/tool, source art, captures, keeper prompts, generated originals) into the repo with a README.
   List the DISCARD items in the report; never delete them silently.
2. **Back up local-only deliverables:** gitignored renders, media and exports made this session that have no
   off-machine copy. Copy them to the project's recorded backup location. If there's none, ask once and record it
   in project memory. Verify by checksum and leave a README.txt. Never delete originals; only *offer* to prune drafts.
3. **Capture know-how:**
   - a repeatable procedure with no SOP → offer to write one;
   - an unrecorded real choice → write the decision file;
   - global gotchas → `bd remember`;
   - user feedback → project MEMORY.md.
4. **Feed the case study:** if the project has portfolio intent or the session made visible before/after change,
   append this session's numbers and quotes and keep the "before" files for slider comparisons. Offer to start the
   draft with the `case-study` skill if none exists.

**Record outcome:** `preserved: N salvaged, M backed up (checksummed) to <where>, SOPs, memories, case study` |
`nothing to preserve` | `needs user: backup location unknown`. A KEEP item still only in scratch/temp, or a
local-only deliverable with no off-machine copy, **blocks** `SAFE TO /clear`.
</step>

<step name="git-hygiene">
**Make sure the session's work is actually backed up - execute HANDOFF.md §5.7.**

Delegate the sweep to `flight-engineer` (git / backups-PRs / secrets dimensions); if it isn't
installed, fall back to inline checks so takeoff still protects the user. Per the standing git
authorization: commit at this checkpoint on a **feature branch, never straight to `main`**, push
unpushed commits, open a PR when a feature is done, and surface the merge as **the human step**.
🔴 HARD STOP if a `.env` / key / secret is about to be committed - name the file, do not commit.

**Record outcome** for the confirm step: `committed+pushed (N) | PR #N opened | merge awaiting
human | secret blocked | clean | not a repo | flight-engineer unavailable -> inline fallback`.
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

## Open Loops
<!-- MANDATORY whenever this session sent a `sidebar` ASK that is still unanswered. A /clear erases
     the fact that you are owed a reply; this section is the only thing that carries it.
     Generate with: python ~/.claude/skills/sidebar/scripts/sidebar.py loops <my-slug>
     (skip if that script isn't installed - `sidebar` is an optional companion, not a dependency)
     Only an `ask` creates a loop - a notify/handover does not. Omit the section when none.
     NEVER carry a loop that has been answered: a closed loop that lingers reads as live. -->
- **`[peer-name]`** · asked `[when]` · id `[sidebar id]` · reply to `[my-slug]`
  - **Asked:** [the question, self-contained]
  - **Blocks:** [what decision is waiting on this]
  - **On silence:** [what you will do if no reply - REQUIRED; `sidebar.py send` refuses an ask without it]
  - **Peer cwd:** [their absolute path if you learned it from their reply - omit the line if you did not]

## Listeners
<!-- omit the section if nothing was polling. One line per listener; landing re-arms every
     `re-arm:` line automatically (Bash, run_in_background) after a catch-up read. -->
- **bus** · slug `[my-slug]` · threads `[thread_ts ...]` · re-arm: `bash ~/.claude/skills/session-bus/scripts/listen.sh [my-slug] [thread_ts ...]`
- **[other watch]** · waiting on `[what]` · re-arm: `[command]` · stand down when: `[condition]`

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
- **Actively OFFER to set it up** (see Setup Wizard in SKILL.md) whenever the project **warrants one** (a real multi-session / ecosystem build, or it already has a `FLIGHT-LOG*.md` — meaning takeoffs have been running handoff-only with no build log). Default **N**, skippable, but make the offer explicit — do NOT bury it or treat "not configured" as a silent skip.
- If the user accepts, also offer to **seed a reconstructed Session-1 backfill** (from `git log` + docs) so pre-recorder history isn't lost, then append this session as the next entry.
- **Record the outcome** (configured+appended / offered→created / offered→declined / not-warranted / not-configured) — it MUST surface in the Postflight banner (see the ⚠️ gap line), never be silently skipped. This is the exact failure that left a busy project with no recorder for many sessions.

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
  ✅ Preserved       [N salvaged into repo · M files backed up to <where> (checksummed) · SOPs/memories/case study]   ← or "nothing outside git to preserve"
  ⚠️ Gaps            [warranted-but-missing surface + its fix, e.g. "Flight Recorder not set up → /takeoff init-recorder"]   ← REQUIRED line whenever a warranted surface (recorder / Tome / Bible) is missing; omit only if there are none

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
