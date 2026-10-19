---
name: session-relaunch
description: Reopen all your Claude Code sessions after a machine/terminal restart on Windows — rebuilding your multi-window Windows Terminal layout with a tab per session, each with its original tab name, window group and order preserved, cd'd into the right folder, in bypass-permissions mode, at a bare prompt (no auto-/landing; pass --landing to opt in). Also writes a dated session-inventory table to the Desktop. Pairs with the flight-deck takeoff/landing workflow. USE WHEN the user says "relaunch my sessions", "reopen my sessions", "restart dance", "restart shuffle", "reopen all my tabs", "get my sessions back", "restore my terminals", "session relaunch", or is about to restart with multiple Claude Code sessions open. Windows + Windows Terminal only. NOT for a single session (just cd + claude), and NOT a substitute for /landing (this launches the terminals; /landing restores context inside each).
---

# Session Relaunch

Kills the post-restart "shuffle": manually reopening N terminal tabs, cd-ing each into the right
project, starting Claude, and running /landing. This automates all of it while preserving your exact
tab names and order.

## How it fits the flight-deck loop

`/takeoff` in each session (writes each folder's `FLIGHT-LOG.md`) → **restart** → **this skill relaunches
every session** at a bare prompt, in bypass mode, cd'd in, with its tab name and window group intact.

**Landing does NOT auto-run.** You pick work back up deliberately — type `/landing` in whichever tab you
actually want to resume. Pass `--landing` to opt back into auto-restore in every tab.
(the user's standing preference, 2026-09-30: relaunch restores the *layout*, not the context.)

## Prerequisites

- Windows with **Windows Terminal** (`wt`) and **PowerShell 7** (`pwsh`).
- Each session's folder should already have a `FLIGHT-LOG.md` (run `/takeoff` first) so `/landing` has
  something to restore. Folders without one still relaunch fine; `/landing` just reports none found.

## Two phases (important)

Tab names live only in the running terminal — once you close it they're gone. So **capture while your
sessions are still open**, then relaunch after the restart.

- **Phase A — Capture (run this skill while your sessions are open):** detect the open sessions, read the
  live tab names + order, confirm the mapping, save it, and set up the title-lock profile.
- **Phase B — Relaunch (after you close everything / reboot):** run the launcher; it rebuilds every tab
  from the saved config. Recurring restarts only need Phase B.

## Workflow

Scripts live in this skill's `scripts/`. Use absolute paths to this skill's directory when invoking them.
The script forces UTF-8 output itself — no `PYTHONUTF8=1` prefix (that's bash-only syntax and errors in PowerShell).

### Phase A — Capture & configure (sessions still open)

1. **Detect the open sessions** (reads `~/.claude/projects/*/*.jsonl` for recent `cwd`s):
   ```bash
   python "<skill>/scripts/relaunch_sessions.py" --detect --json
   ```
   Returns `[{"title": <folder-derived>, "path": <cwd>}, ...]`, most-recent first. Widen with
   `--minutes N` (default 180) if some sessions are older.

2. **Read the live tab names + order** (UI Automation — no admin):
   ```bash
   pwsh -NoProfile -File "<skill>/scripts/capture_wt_tabs.ps1"
   ```
   Returns `[{"window": "...", "tabs": ["KB","BS",...]}, ...]` in tab-strip order.

2b. **Cross-check against `ListAgents`.** It lists the live Claude sessions; `--detect` lists *folders
    with recent transcripts*, which is a wider and noisier set (it picks up temp dirs, subfolders, and
    sessions that have since exited). `ListAgents` is the authority on what is actually running.
    Reconcile the three counts (tabs / live sessions / detected folders) and **state the discrepancy**
    rather than silently padding the config.

3. **Propose the tab → folder mapping** and confirm with the user. Match rules:
   - If the tab **count equals** the live-session count, align by best name↔folder similarity
     (e.g. tab `BS` ↔ folder `...\brand-studio`, `AS` ↔ `...\acme-store`), then present the full
     ordered mapping and ask the user to confirm or correct.
   - If counts **differ** (a tab that isn't a Claude session, or a session in a background window),
     show both lists and let the user resolve — never guess silently. Put a `_check` note on any entry
     you had to guess so the uncertainty survives into the config.
   - Preserve the **tab order** from step 2 (that's the order tabs reopen in).

4. **Save the confirmed mapping** to `~/.claude/session-relaunch.json`, **with a `window` key per
   session** so a multi-window layout survives:
   ```json
   { "sessions": [
       { "window": "infra",    "title": "KB",        "path": "G:\\...\\KB-CONTROL-ROOM" },
       { "window": "client",   "title": "SHOP SITE", "path": "C:\\...\\shop-website" }
   ] }
   ```
   Sessions sharing a `window` value open as tabs in that one WT window; omit the key and they land in
   the default window. **Group them the way the user had them** (step 2 returns one entry per window —
   use those groupings, don't flatten 4 windows into 1). Write it directly, or have the user edit it.
   This is the durable config — future restarts reuse it.

4b. **Write a session inventory doc** (the user's standing ask, 2026-09-30) — a dated Markdown table on
    the Desktop, e.g. `SESSIONS-YYYY-MM-DD.md`, grouped by window, with: tab name, cd path, what the
    project is, and current work status. **Tag every status cell with its source** and never invent one:
    - `[log MM-DD]` from that folder's `FLIGHT-LOG.md` — *print the log's own date*, so a stale handoff
      is visible as stale.
    - `[git]` from live `git status` (branch, uncommitted count, ahead/behind).
    - `[no takeoff]` when no `FLIGHT-LOG.md` exists — a **blank, not** "nothing happening."

    End the doc with an **Open Questions** list for anything you could not resolve, and a
    **dirty-tree warning list** (every repo with uncommitted files), since those are what a restart
    strands. Capture is usually mid-takeoff, so say how many folders had a log (e.g. "11 of 40") and
    offer to refresh once the user's takeoffs finish.

5. **Create the title-lock profile** (idempotent; backs up `settings.json` once):
   ```bash
   python "<skill>/scripts/relaunch_sessions.py" --setup-profile
   ```
   Adds a **hidden** WT profile `Claude Relaunch` with `suppressApplicationTitle: true`. Without this,
   Claude Code overwrites your tab titles on launch. Hidden = it won't clutter the profile dropdown but
   is still launchable by name.

6. **Hand off Phase B.** Tell the user: close your sessions (or reboot), then run the Phase B command.
   Offer `--dry-run` first. Do **not** relaunch from inside a still-open set — it would duplicate tabs.

### Phase B — Relaunch (after closing / rebooting)

```bash
python "<skill>/scripts/relaunch_sessions.py"            # from the saved config (no /landing)
python "<skill>/scripts/relaunch_sessions.py" --dry-run  # preview
python "<skill>/scripts/relaunch_sessions.py" --landing  # also auto-run /landing in every tab
```
Each tab launches as (note `-w <window>` comes from the session's `window` key):
```
wt -w infra new-tab --profile "Claude Relaunch" --title <T> \
   pwsh -NoExit -Command "Set-Location -LiteralPath '<path>' && claude --dangerously-skip-permissions"
```
The dry-run header reports the real window set, so verify it before launching:
```
DRY RUN - Relaunching 39 session(s) into 4 window(s): infra, crm, client, creative
          | bypass=on | landing=off | title-lock=on
```
**Check the per-window tab counts against the Phase A capture** — they should match exactly.

## Mechanics & gotchas (encoded in the launcher — know them for debugging)

- **`&&`, not `;`**, chains the Set-Location + claude command — `wt` treats `;` as a tab separator, so a
  `;` inside `-Command` would fragment the launch. `pwsh` 7 supports `&&`.
- **Set-Location runs in `-Command`, not via `--startingDirectory`** — the user's pwsh profile often
  `Set-Location`s on startup and would override `--startingDirectory`; `-Command` runs after the profile,
  so it wins.
- **Title-lock needs the profile.** `--title` alone loses to Claude Code's own title updates unless the
  launching profile has `suppressApplicationTitle: true`. That's why step 5 exists.
- **Landing is opt-in, not default.** `--landing` passes `/landing` as the initial prompt; without it
  tabs open at a bare prompt. `--no-landing` is kept as an accepted no-op for old muscle memory.
- **A session's own tab name can already be lost at capture time.** Claude Code overwrites the tab title
  with the current task summary unless the tab was launched under the title-lock profile — so the tab
  you are *running in* often reports a task string (e.g. `◐ Logitech Brio webcam usage`) instead of its
  real name. You cannot recover it; **ask the user what that tab should be called.** After one relaunch
  through this skill every tab is title-locked and the problem disappears.
- **Two sessions can share one path.** the user runs multiple seats on `~/projects`. Duplicate
  `path` values with different `title`s are valid — don't dedupe them.
- **Windows must exist as distinct `-w` names.** WT creates a window on first use of a name, so tab
  order within a window follows config order, and the windows themselves appear in first-seen order.
- **`--detect` fallback**: with no saved config, `--detect` builds the list live from transcripts (titles
  derived from folder names — not custom tab names). Good for a quick relaunch; Phase A gives real names.

## Fast path (don't care about custom names)

```bash
python "<skill>/scripts/relaunch_sessions.py" --detect --save-config   # once
python "<skill>/scripts/relaunch_sessions.py"                          # thereafter
```

## Team sharing

The skill hardcodes no personal paths — each machine's sessions come from that machine's transcripts and
its own `~/.claude/session-relaunch.json`. Distribute via the team toolkit (`toolkit-publish`). Each
teammate runs Phase A once to record their tab names, then Phase B on every restart.
