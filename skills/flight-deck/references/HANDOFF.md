# Handoff Process (takeoff)

The `/takeoff` command creates a session handoff and optionally appends to the Flight Recorder.

## 0. Resolve Current User (multi-user / team mode)

**Do this first, before touching any file.** More than one person can share a project folder; per-user session state is what stops takeoffs from squashing each other.

Resolve a slug `<user>` (order, first hit wins): `~/.claude/skills/flight-deck/config.yml` `user_id` → `git config user.name` (slugified) → OS username → prompt once and save to `config.yml`. Full rules, slugify, and the file model in [MULTI-USER.md](MULTI-USER.md).

Carry `<user>` through the rest of takeoff. Determine the mode from `.flight-recorder.yml multi_user` (default `true` when unset): `true` → per-user flight log + attributed recorder; `false` → legacy single `FLIGHT-LOG.md`, no attribution.

## 0.5. Resolve the lane (one person, many terminals)

**Optional second shard.** After `<user>`, resolve an optional `<lane>` so parallel terminals on the same repo don't squash each other. Order, first hit wins; **no signal → no lane** (write `FLIGHT-LOG.<user>.md` exactly as before):

1. `FLIGHT_DECK_LANE` env var → slugify → `<lane>`.
2. A lane declared in this session ("this is the sales lane") → use it.
3. No env var, no declaration → no lane. Only *offer* one (one line, declinable) if the squash-risk condition holds — see [MULTI-USER.md](MULTI-USER.md) §2.5.

When a lane resolves, write to `FLIGHT-LOG.<user>.<lane>.md` throughout takeoff. `<lane>` slugifies like `<user>`. The `FLIGHT-RECORDER.md` is **unchanged** — it stays one shared project timeline; lanes shard only the personal flight log, not the build log.

## 1. Detect Project Context

**Check for active scaffolding:**

```
GSD:              .planning/STATE.md exists?
Planning files:   task_plan.md exists?
Project log:      PROJECT_LOG.md exists?
Bible Keeper:     .bible-keeper.json or BIBLE*.md exists?
Canon Keeper:     TOME.md exists?
Flight Recorder:  .flight-recorder.yml exists?
```

**Check git state:**
```bash
git status --porcelain  # uncommitted changes
git log -1 --oneline    # last commit
```

## 2. Gather State

Collect from conversation and files:

| Category | Source |
|----------|--------|
| Objective | User's original request or task_plan.md goal |
| Completed | Session work, checked items, commits |
| Remaining | Unchecked items, stated next steps |
| Decisions | Key choices made with rationale |
| Blockers | Issues encountered, workarounds |
| Files | Modified but uncommitted paths |

**Ask user** if any critical context is unclear.

## 3. Write the Flight Log

**Multi-user mode (`multi_user` ≠ `false`):** write to `FLIGHT-LOG.<user>.md` in the project root (or `FLIGHT-LOG.<user>.<lane>.md` when a lane is set — see §0.5) — your own file, which only your takeoffs overwrite. A teammate's `FLIGHT-LOG.<other>.md` is never touched. A legacy plain `FLIGHT-LOG.md` is **never renamed silently**: if it's a router/index file (points at other flight logs) or someone else's, leave it; if it looks like your own prior handoff, **ask before renaming** it to `FLIGHT-LOG.<user>.md`. See [MULTI-USER.md](MULTI-USER.md) §4.

**Legacy mode (`multi_user: false`):** write to `FLIGHT-LOG.md` as before.

```markdown
---
project: [project name]
user: [user]
timestamp: [ISO timestamp]
scaffolding: [gsd | planning-files | project-log | none]
flight_recorder: [true | false]
---

# Session Handoff

## Objective
[What we're trying to accomplish]

## Progress
**Status:** [X]% complete | Phase Y of Z

### Completed
- [x] Item 1
- [x] Item 2

### Remaining
- [ ] Item 3
- [ ] Item 4

## Key Decisions
- **[Decision]**: [Rationale]

## Blockers
- [Blocker]: [Status/workaround]

## Uncommitted Changes
```
[git status output or "None"]
```

## Scaffolding State
[GSD phase info, task_plan status, etc.]

## Next Action
**Start with:** [Specific first action for next session]

## Context Notes
[Mental state, approach being taken, anything important]
```

## 3.5. Sync to Beads (if configured)

**Check:** Does `~/.claude/beads/.beads/` exist?

If yes — sync remaining items from the handoff to the Beads task database.

**Project label source:** Use the `project:` value from the FLIGHT-LOG.md frontmatter as the Beads label. This ensures the label is stable and consistent across takeoff and landing sessions.

```bash
# Check for existing open tasks first (avoid duplicates)
cd ~/.claude/beads && bd list --label project:[project-name] --status open

# Create tasks for remaining items not already in Beads
bd create "Task title" --label project:[project-name] --type task

# Blockers get blocked status
bd create "Blocker description" --label project:[project-name] --type task --status blocked
```

- Only create tasks that don't already exist as **open** tasks (completed tasks don't count — they may recur)
- Skip decisions and rationale — that's Flight Recorder's domain, not Beads'
- If Beads doesn't exist: skip this step — but still **record the outcome** (`not configured`) for the Postflight Verification report (Step 6). Do not skip *silently and forgetfully* — silent-skip is the exact failure mode that hid the Step 5 INDEX drift for five days.

**Record outcome** for Step 6: `updated` (N tasks synced) / `disabled` / `not configured`.

**Global database location:** `~/.claude/beads/` (initialize with `cd ~/.claude/beads && bd init`)

---

## 3.6. Bible / Tome Sync — keep durable memory current (parity with the Flight Recorder)

**Detect (exist? y/n):** `.bible-keeper.json` in project, any `BIBLE*.md` (depth ≤3), or `TOME.md` in project root.

**If none found → consider offering setup (do NOT just skip silently).** Gate on project-appropriateness so this never nags a scratch folder:

- **Appropriate** when the project looks substantial and canon-bearing: `CLAUDE.md` present **and** at least one of — Flight Recorder already active with `session_count ≥ 2` (a real multi-session build); multiple sub-repos/sites (several `.git`/`package.json` under subdirs → ecosystem); or the session clearly involved cross-doc lore / decisions worth preserving.
- **Not appropriate** (skip silently, no offer): no `CLAUDE.md`, a throwaway/scratch folder, a one-off task, or the user already declined this offer for this project (see the marker below).

If appropriate and not previously declined, offer **once**, default N (non-nagging):

```
This project has no durable canon memory yet. Want to set one up?

  [T] Keeper's Tome (canon-keeper) — for ecosystems: multi-repo/site/lore
                                     consistency, a living front page + history
  [B] Bible (bible-keeper)         — for long multi-track builds: a decision
                                     log organized by department/topic
  [N] Not now                      (Enter = N)

Choose [T/B/N]:
```

- **T** → delegate to `/canon-keeper` to scaffold a Tome, then run the `/canon-keeper takeoff` sync below for this session.
- **B** → delegate to `/bible-keeper` setup, then run its batch scan below.
- **N / Enter** → skip. **Record the decline** so it doesn't nag again: set `.flight-recorder.yml durable_memory: declined` if a recorder config exists, else note it in this session's FLIGHT-LOG. Do not re-offer this project unless the user asks.

Record outcome for Step 6: `offered→configured` / `offered→declined` / `not-appropriate` / (or the sync outcomes below if a surface already existed).

**Governing principle (why this step is not optional).** A Tome or Bible is a *durable memory surface* exactly like the Flight Recorder — and takeoff keeps **all** of them current, not just the recorder. The failure this step exists to prevent: the recorder gets a fresh entry every takeoff (auto, always-on) while the Tome's **front page** (Current Session / Next action / Open Threads / Known Drift) silently freezes, because plain takeoff only *appended history* and never *refreshed state*. When one memory surface drifts weeks behind another, resume lands on stale context. So on a keeper/bible project this runs **by default, every takeoff** — same posture as the recorder — not an opt-in prompt.

**If `TOME.md` is present (a keeper-enabled project):** perform the **`/canon-keeper takeoff` Tome update** — refresh the Tome's front page (Current Session, Next action; move done items out of Open Threads and add current ones; update Known Drift / Active Decisions) **and** append the session entry to `TOME-LOG.md`. This is the front-page-refreshing procedure — **NOT** `/canon-keeper log`, which only appends history and is the exact thing that let the front page go stale. Delegate the writing to canon-keeper (flight-deck does not hand-edit Tome files). If the user *already* ran `/canon-keeper takeoff` to close the session, this is done — don't double-run.

**If a Bible is present:** invoke `/bible-keeper` (no args = batch scan the conversation for unlogged decisions). Delegate the writing to bible-keeper.

**If both:** Bible first, then the Tome update.

**Multi-user:** pass `<user>` through to `/canon-keeper takeoff` and `/bible-keeper` so their entries can be attributed (e.g. note "session by `<user>`" in the summary handed over). Those skills own their own file layout — Flight Deck supplies the author, not the sharding. See [MULTI-USER.md](MULTI-USER.md) §5.

**Skip only on an explicit opt-out** this session (user says skip / nothing worth logging). Do NOT silently skip — a keeper project with a fresh recorder entry and a frozen Tome front page is the drift this step prevents.

**Record outcome** for Step 6: `synced` (front page refreshed + log appended) / `declined` (user opted out) / `already-done` (session closed via `/canon-keeper takeoff`) / `disabled` / `not configured`. Same anti-silent-skip discipline as Step 3.5 — the outcome must surface in the Postflight report, not vanish.

---

## 4. Flight Recorder Check (always run this step)

**Determine project root first** — where FLIGHT-LOG.md was written. All files will live here.

**If `.flight-recorder.yml` exists and `enabled: true`:**
1. Read config to get default mode and active lenses
2. Check if `/takeoff debrief` was invoked (override to debrief mode)
3. Check for debrief auto-trigger signals (suggest escalation if detected)
4. Extract session data according to the active mode
5. **Integrity check (before any write).** Read `.flight-recorder.yml session_count` and any `known_gaps` list. Parse the session headings already present in `FLIGHT-RECORDER.md`. Verify the heading sequence is contiguous up to the current `session_count`, **except** for sessions explicitly listed in `known_gaps`. If an *unexpected* gap appears (a session number missing and not in `known_gaps`), **halt before appending** and report `TAKEOFF INCOMPLETE: flight recorder integrity gap` naming the missing session number(s).
6. **Append first, bump second — this order is load-bearing, do not swap it.**
   0. **Multi-user:** `FLIGHT-RECORDER.md` is the ONE shared build log for the whole project — never sharded per user. Re-read it and `.flight-recorder.yml` *now* to get the true latest `session_count` (don't trust a value cached earlier this session — a teammate may have appended since). Attribute the new entry by putting `by: <user>` in its heading: `## Session N | YYYY-MM-DDTHH:MMZ | by: <user> | [mode]`. Also scan for sync-conflict artifacts (`FLIGHT-RECORDER.sync-conflict-*.md`, `*.conflicted.md`) beside the file — if present, halt and flag for manual merge rather than appending over a possibly-stale copy. See [MULTI-USER.md](MULTI-USER.md) §6.
   1. Append the new entry to `FLIGHT-RECORDER.md`.
   2. Re-read the file and verify the new session heading now exists.
   3. **Only after** the heading is confirmed, increment `session_count` in `.flight-recorder.yml`.
   - **Rationale:** if the process dies between append and bump, the counter is *behind* the content — recoverable by backfilling the counter (easy). The reverse (counter ahead of content) needs forensics and is often unrecoverable. Sessions 3 + 47 are the documented cost of the wrong order.
   - If the append succeeds but the counter bump fails, report `TAKEOFF INCOMPLETE: session_count not incremented` with the manual fix (set `session_count` to match the newest heading).

**If `.flight-recorder.yml` does NOT exist:**
1. Check if `CLAUDE.md` exists in the project root — note whether the project is configured
2. Display the following prompt to the user:

```
No Flight Recorder found for this project.

  Project root:   [absolute path]
  CLAUDE.md:      [Found ✓ | Not found — project may not have a config]

  If you set one up, these files will be created here:
    [absolute path]/.flight-recorder.yml   ← recorder config
    [absolute path]/FLIGHT-RECORDER.md     ← running build log

  Set up a Flight Recorder? [Y/n]
```

- **Y** → run `/takeoff init-recorder` wizard (see FLIGHT-RECORDER.md for setup details)
- **n** → skip, proceed with handoff only. Do NOT ask again this session.

**Note:** If `.flight-recorder.yml` exists with `enabled: false`, skip silently — user already opted out.

See [FLIGHT-RECORDER.md](FLIGHT-RECORDER.md) for full recorder details.

## 5. Update Central Flight Recorder Index

Central index handling is explicit, never implicit.

**Where the index path is configured** (resolution order):

1. `.flight-recorder.yml central_index_path` (project-local override), if present.
2. The per-user flight-deck config `central_index_path` at `~/.claude/skills/flight-deck/config.yml`.
3. Otherwise unconfigured.

Match the project row by **normalized path**, not project name — names collide across folders, paths don't (normalize casing, slashes, trailing slash).

Determine central index configuration:

1. Read `.flight-recorder.yml`.
2. If `central_index: false`, skip this step and record: `Central index: disabled`.
3. Resolve the index path:
   - First use `.flight-recorder.yml central_index_path`, if present.
   - Otherwise use the per-user flight-deck config `central_index_path`.
4. If no index path is configured, skip this step and record: `Central index: not configured`.
5. If an index path is configured, this step is mandatory.

Mandatory update behavior:

1. Open the configured `INDEX.md`.
2. Find the row whose project path matches the current project root.
3. If no row exists, append a new row for this project (auto-create — do not refuse; name, path, lenses, count, date are all known).
4. Set the row's session count to `.flight-recorder.yml session_count`.
5. Set the row's last entry date to the date of the newest appended `FLIGHT-RECORDER.md` entry.
6. Set lenses from `.flight-recorder.yml lenses`.
7. Preserve unrelated rows.

Validation:

After writing, re-read `INDEX.md` and verify:

1. Exactly one row matches the current project path.
2. The row's session count equals `.flight-recorder.yml session_count`.
3. The row's last entry date equals the newest `FLIGHT-RECORDER.md` entry date.
4. The row's lenses match `.flight-recorder.yml lenses`.

If validation fails, stop `/takeoff` and report:

`TAKEOFF INCOMPLETE: central index update failed`
Include the configured index path, expected values, observed values, and the manual fix needed.

## 5.7. Git & GitHub Hygiene — surface state, take safe actions (delegate to flight-engineer)

Non-engineer "vibe coders" often forget to commit / push / open a PR and don't know the SOP. Now that the durable files are written (flight log, recorder, index, Bible/Tome), this step makes sure that work is actually **backed up** — in plain language, taking the safe actions automatically per the standing git authorization (Claude drives the flow; merges stay human).

**Do not reimplement the sweep here — delegate to `flight-engineer`** (the single hygiene engine). Run its git / backups-PRs / secrets dimensions (1–3) and surface the result in the takeoff voice. If `flight-engineer` is unavailable (not installed), fall back to the inline checks below so takeoff still protects the user.

**Detect (via flight-engineer):**
- Uncommitted changes — including the durable memory files this takeoff just wrote.
- On `main` vs a feature branch.
- Unpushed commits; behind remote (fetch first).
- Open PRs (`gh pr list`) + their checks (`gh pr checks`).
- Secrets in anything about to be committed (quick scan).

**Act + report plainly (one-line "why" each):**
- **Commit** the session's work at this checkpoint — on a **feature branch, NEVER straight to `main`** (commit = your checkpoint). Include the durable memory files.
- **Push** unpushed commits ("N commits aren't backed up to GitHub yet — pushing"; push = your off-machine backup).
- **Open a PR** when a feature is complete (`gh pr create`) (PR = a reviewable proposal).
- **Offer `codex review`** on the branch first — the team's non-Anthropic pre-approval review step (if `codex` is available).
- **Surface the merge as the HUMAN step** — *"PR #N is ready and checks pass — it needs your approve-and-merge."* Claude runs the merge only on an explicit yes; never auto-merge.
- **Flag failing CI** in plain terms (which check, what it means).
- 🔴 **HARD STOP** if a `.env` / key / secret is about to be committed — do not commit; name the file.

**Portability:** respect a teammate's own approve-and-merge flow; do not assume a specific org or remote. If it's not a git repo, or `gh` isn't available, skip cleanly and say so.

This **complements** (does not replace) the deterministic session-end git-reminder hook (which prints uncommitted / unpushed / behind counts). This step is the richer, actionable, plain-language version that also *takes* the safe actions.

**Record outcome** for Step 6: `committed+pushed` (N commits) / `PR #N opened` / `merge awaiting human` / `secret blocked` / `clean — nothing to do` / `not a repo` / `flight-engineer unavailable → inline fallback used`. Same anti-silent-skip discipline as Steps 3.5 / 3.6 — the outcome must surface in the Postflight report, not vanish.

## 6. Postflight Verification

Before confirming completion, verify and report:

- `FLIGHT-LOG.<user>.md` (or legacy `FLIGHT-LOG.md`): written for current session
- `FLIGHT-RECORDER.md`: new entry appended, attributed `by: <user>` (heading confirmed present)
- `.flight-recorder.yml session_count`: incremented
- Central index: updated / disabled / not configured
- Task DB sync: updated / disabled / not configured
- Git & GitHub: committed+pushed / PR opened / merge awaiting human / secret blocked / clean / not a repo (Step 5.7 outcome)
- Bible/Tome: synced (front page refreshed + log appended) / already-done (closed via `/canon-keeper takeoff`) / offered→configured / offered→declined / not-appropriate / declined / disabled / not configured
  - **On a keeper project, `not configured` for the recorder but a stale Tome is a red flag** — if `FLIGHT-RECORDER.md` got an entry this session and `TOME.md`'s Current Session date did NOT advance, the front page drifted: report it, don't call takeoff complete.

If any configured system fails validation, **do not say takeoff is complete**.
Say: `TAKEOFF INCOMPLETE` and name which system failed + the manual fix.

> **Governing principle:** *Trust the LLM for synthesis, not for durable state transitions.* Summarizing the session, inferring context, writing prose — fine to trust. Anything that mutates canonical shared state (the index, the counter, the recorder, the task DB) must have a verify-and-report contract. A step that "skips silently" instead of reporting its outcome is the failure shape that hid the index drift for five days (Sessions 53–55) and produced the Sessions 3 + 47 recorder gaps.

## 7. Confirm

The takeoff message has two jobs: summarize what was saved, and tell the user **plainly whether it is now safe to `/clear`**. The `🧹 SAFE TO /clear` banner is the load-bearing UX of this whole skill — it is shown **only when Step 6 Postflight verification passed for every configured system**. If anything came back `TAKEOFF INCOMPLETE`, show the ⛔ banner instead and name the fix. **Never tell the user it's safe to clear when a durable write didn't persist** — that is exactly how a session's work gets lost.

**Formatting notes:** the `═`/`─` rules are fixed-length decorative rules — keep content left-anchored under them, do **not** draw a right-hand border (emoji are double-width and will misalign a right edge). Emojis are section markers, not decoration; keep them consistent so the eye learns them. Fill every `[…]` with real values. Drop any line whose system is `not configured` rather than printing "skipped" noise.

**Wayfinding (`📍`) line** — answers "which project/folder is this?" at a glance (essential when several sessions run at once). Show `project · absolute project root · branch` (drop the branch if not a git repo). For a **multi-repo/site ecosystem**, show the primary root on the `📍` line and list the others indented beneath it, e.g.:
```
  📍 my-ecosystem · ~/projects/my-ecosystem  (hub)
     ├ web  ~/projects/my-ecosystem/web
     └ api  ~/projects/my-ecosystem/api
```

### 7a — Verified complete (all configured systems passed)

**Flight Recorder configured:**
```
🛫 ═══════════════ TAKEOFF COMPLETE ═══════════════

  📍 [project] · [abs project root] · [git branch, if a repo]

  ✅ Flight log      FLIGHT-LOG.<user>.md
  ✅ Flight Recorder Entry #N appended ([mode])
  ✅ Beads           [N tasks synced]          ← omit line if not configured
  ✅ Bible / Tome    [front page refreshed + log appended]   ← omit if n/a

  📋 Objective   [brief]
  📊 Progress    [X]% · [completed]/[total] items
  ➡️  Next        [first action for next session]

  ─────────────────────────────────────────────
  🧹 SAFE TO /clear  —  your full state is saved.
     Resume anytime with  /landing  (or /slamdunk)
═══════════════════════════════════════════════════
```

**Flight Recorder NOT configured** (same block, drop the Flight Recorder line):
```
🛫 ═══════════════ TAKEOFF COMPLETE ═══════════════

  📍 [project] · [abs project root] · [git branch, if a repo]

  ✅ Flight log      FLIGHT-LOG.<user>.md
  ✅ Beads           [N tasks synced]          ← omit line if not configured

  📋 Objective   [brief]
  📊 Progress    [X]% · [completed]/[total] items
  ➡️  Next        [first action for next session]

  ─────────────────────────────────────────────
  🧹 SAFE TO /clear  —  your flight log is saved.
     Resume anytime with  /landing  (or /slamdunk)
═══════════════════════════════════════════════════
```

### 7b — TAKEOFF INCOMPLETE (any configured system failed Step 6)

Show what DID save, then the ⛔ banner naming the failed system and its manual fix. Do **not** show the `/clear`-safe line.
```
🛫 ═══════════════ ⛔ TAKEOFF INCOMPLETE ═══════════

  📍 [project] · [abs project root] · [git branch, if a repo]

  ✅ Flight log      FLIGHT-LOG.<user>.md
  ⛔ [system]        [what failed — e.g. session_count not incremented]

  ─────────────────────────────────────────────
  ⛔ DO NOT /clear yet  —  [system] did not save.
     Fix: [exact manual fix], then re-run /takeoff.
═══════════════════════════════════════════════════
```

## File Locations

Always create in project root (same level as `.git` if present).
Never create in user home directory or system folders.

**Per-user vs shared** (see [MULTI-USER.md](MULTI-USER.md) §2):
- `FLIGHT-LOG.<user>.md` — per-user; only your own takeoff writes it.
- `FLIGHT-RECORDER.md` + `.flight-recorder.yml` — one shared copy for the whole project (recorder entries attributed `by: <user>`, single global `session_count`).
