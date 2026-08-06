# Integration Points & Best Practices

## Integration Points

### Beads Detection
If `~/.claude/beads/.beads/` exists (global task database):
- **Takeoff**: Remaining items from handoff → create `bd` issues tagged with project label
  - `bd create "Task title" --label project:[project-name] --type task`
  - Blockers → `bd create ... --status blocked`
  - Skip decisions/rationale (that's Flight Recorder's job, not Beads')
- **Landing**: Query open tasks for this project
  - `cd ~/.claude/beads && bd list --json --label project:[project-name] --status open`
  - `bd ready --json` → what's unblocked right now
  - Inject as "Active Beads Issues" section in the landing summary
- **PreCompact hook**: `bd prime` auto-fires before context compaction — injects ~1-2k tokens of current task state. This is the core "smart zone" compaction mechanism.
- **SessionStart hook**: `bd prime` also fires on every new session — reconstructs task context automatically.

**Global database location:** `~/.claude/beads/` (initialize once with `bd init` there)
**Hook commands:** `cd "~/.claude/beads" && bd prime` (PreCompact + SessionStart)
**Install:** `winget install SteveYegge.Beads DoltHub.Dolt` (Windows) or `brew install beads dolt` (Mac/Linux), then `cd ~/.claude/beads && bd init && bd setup claude`

**Beads vs Flight Recorder — who owns what:**
| Concern | Owner |
|---------|-------|
| Open tasks, blockers, dependencies | Beads (`bd`) |
| Session narrative, decisions, rationale | Flight Recorder |
| Immediate "where was I?" context | FLIGHT-LOG.md |
| Pre-compaction task state | Beads (auto via hook) |

### GSD Detection
If `.planning/STATE.md` exists:
- Include current phase and task number in handoff
- Reference `.continue-here.md` if present
- Suggest `/gsd:progress` on resume
- Flight Recorder: phase transitions trigger debrief auto-suggestion

### Durable-memory parity (the load-bearing rule)

A **Tome (canon-keeper)** and a **Bible (bible-keeper)** are durable memory surfaces on the same footing as the **Flight Recorder** — takeoff keeps **all** of them current, landing surfaces **all** of them. Treat them with recorder parity, not as an optional afterthought:

- **Takeoff is auto/always-on for every detected surface**, not an opt-in prompt. The recorder gets an entry; the Tome front page gets refreshed; the Bible gets its scan. Skipping is an explicit user choice, reported — never a silent default.
- **The Tome has TWO layers, and takeoff must touch the front page, not just the log.** `/canon-keeper log` only appends to `TOME-LOG.md` (history) — it does **not** refresh `TOME.md`'s Current Session / Open Threads / Next action. A takeoff that only logs lets the front page freeze while the recorder stays fresh. **Use `/canon-keeper takeoff` (front-page refresh + log append), never `/canon-keeper log`, at session close.**
- **Landing detects drift between surfaces, not just absolute age.** A Tome front page N sessions behind the recorder is stale even if `lastVerified` looks recent.

*(This rule exists because a real session shipped 6+ sessions of work with a fresh recorder and a Tome front page frozen at day one — plain `/takeoff` + `/canon-keeper log` updated history but never the front page.)*

### Bible Keeper Detection

If `.bible-keeper.json` or any `BIBLE*.md` (depth ≤3) is found in the project:

- **Takeoff** (Bible/Tome Sync step): run by default — invoke `/bible-keeper` batch scan mode to capture unlogged decisions → delegate writing → return to takeoff flow. Skip only on explicit opt-out.
- **Landing**: Read last entry date from each Bible, surface in summary:
  - `Bibles:  Marketing (2d ago) | Sales (no entries)`
  - If last entry > 7 days during an active build, flag in suggested next action
- **If neither `.bible-keeper.json` nor `BIBLE*.md` exists:** don't just skip — if the project is *appropriate* (`CLAUDE.md` + a real multi-track/multi-session build) and not previously declined, **offer to set one up** once, default N (see HANDOFF.md §3.6 for the exact prompt). Not-appropriate or already-declined → skip silently.

### Canon Keeper Detection

If `TOME.md` exists, this is a **keeper-enabled project**:
- **Takeoff** (Bible/Tome Sync step): run **`/canon-keeper takeoff`** by default — it refreshes the Tome front page (Current Session / Next action / Open Threads / Known Drift / Active Decisions) AND appends the session entry to `TOME-LOG.md`. **Do NOT use `/canon-keeper log`** for session close — it is append-only and leaves the front page stale (see the parity rule above). If the user closed the session *via* `/canon-keeper takeoff` directly, it's already done — don't double-run.
- **Landing**: surface the Tome and check for front-page drift:
  - `Keeper's Tome:  Last sync 3d ago | Status: green` — Status green (<7d), yellow (7-30d), red (>30d)
  - **Front-page drift:** compare `Current Session → Last session` date vs the newest `FLIGHT-RECORDER.md` entry; if the recorder is >~1 session newer, flag `Tome front page STALE — N behind recorder`.
  - Recommend **`/canon-keeper landing`** as the native, richer resume (reads Current Session + Open Threads + Active Decisions from the Tome).
- **Suggested next action:** front-page drift → `/canon-keeper audit`; stale `lastVerified` (>30d) → `/canon-keeper audit`; yellow (7-30d) → `/canon-keeper sync`.
- **If `TOME.md` does NOT exist:** on an *appropriate* project (ecosystem: multiple repos/sites/lore, `CLAUDE.md` present) and not previously declined, **offer to scaffold a Tome** once via `/canon-keeper` (default N). Not-appropriate or already-declined → skip silently. The setup-offer prompt lives in HANDOFF.md §3.6.
- Flight Recorder operates alongside (separate files, separate purposes).

### Planning Files Detection
If `task_plan.md` exists:
- Include current phase status
- Extract remaining items
- Reference notes.md if present

### Project Log Detection
If `PROJECT_LOG.md` exists:
- Include latest log entry
- Reference current status

### Case Study Integration
The Flight Recorder feeds into the case-study skill:
- `/case-study init --from-recorder` can ingest `FLIGHT-RECORDER.md` as source material
- Debrief entries are weighted higher (richer content with user's voice)
- Journey lens entries map to case study narrative
- Technical lens entries map to internal case study
- Business lens entries map to outcomes/metrics

### Distill Integration
The Patterns lens is structured for pattern extraction via the distill skill:
- "Distill candidate" flags mark entries worth extracting into skills or workflows
- Pattern entries include enough context to be clustered across projects
- Session mode tag helps weight entries (debrief > checkpoint > auto)

---

## Hooks Safeguard

A passive safety net runs via Claude Code hooks — no configuration needed beyond `.flight-recorder.yml`.

**On session end (`/clear` or `/exit`):** Checks if `FLIGHT-RECORDER.md` was modified during the session. If not → writes `.flight-recorder-warning.json` to the project root.

**On next session start:** If the warning file exists, Claude is notified immediately:
```
⚠️  FLIGHT RECORDER: Session ended without /takeoff
You hit /clear X minutes ago without running /takeoff.
Run /takeoff now to capture that session, or continue if you're fine losing it.
```

The warning file deletes itself after being shown once. Only fires on projects with `.flight-recorder.yml` (`enabled: true`) where `FLIGHT-RECORDER.md` already exists.

Hook files: `~/.claude/hooks/flight-recorder-check.js` (SessionEnd) and `~/.claude/hooks/flight-recorder-warn.js` (SessionStart).

---

## Best Practices

1. **Be specific** — Next action should be immediately actionable
2. **Preserve decisions** — Don't lose rationale for choices
3. **Note blockers** — Future you needs to know what's stuck
4. **Include file paths** — What files were being worked on
5. **Mental context** — The "why" behind the approach
6. **Flight Recorder brevity** — Auto entries should be concise. Save detail for debriefs.
7. **Debrief at milestones** — Use `/takeoff debrief` at pivots and completions, not every session
8. **Patterns lens** — Flag anything that felt reusable. Future you will thank present you.

---

## File Locations Summary

| File | Location | Scope | Created by |
|------|----------|-------|------------|
| `FLIGHT-LOG.<user>.md` | Project root | Per-user | Every `/takeoff` (overwrites only your own) |
| `FLIGHT-RECORDER.md` | Project root | Shared (attributed) | First `/takeoff` with recorder enabled (appended) |
| `.flight-recorder.yml` | Project root | Shared | Setup wizard (one-time config) |
| `config.yml` | `~/.claude/skills/flight-deck/` | Per-user / machine | Your `user_id` + local paths (gitignored) |

Legacy `multi_user: false` projects keep a single `FLIGHT-LOG.md`. See [MULTI-USER.md](MULTI-USER.md).

Always create in project root (same level as `.git` if present).
Never create in user home directory or system folders.
