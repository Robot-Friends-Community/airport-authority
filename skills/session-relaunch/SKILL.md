---
name: session-relaunch
description: Reopen all your Claude Code sessions after a machine/terminal restart on Windows — one Windows Terminal window with a tab per session, each with its original tab name + order preserved, cd'd into the right folder, in bypass-permissions mode, auto-running /landing to restore that folder's FLIGHT-LOG.md. Pairs with the flight-deck takeoff/landing workflow. USE WHEN the user says "relaunch my sessions", "reopen my sessions", "restart dance", "restart shuffle", "reopen all my tabs", "get my sessions back", "restore my terminals", "session relaunch", or is about to restart with multiple Claude Code sessions open. Windows + Windows Terminal only. NOT for a single session (just cd + claude), and NOT a substitute for /landing (this launches the terminals; /landing restores context inside each).
---

# Session Relaunch

Kills the post-restart "shuffle": manually reopening N terminal tabs, cd-ing each into the right
project, starting Claude, and running /landing. This automates all of it while preserving your exact
tab names and order.

## How it fits the flight-deck loop

`/takeoff` in each session (writes each folder's `FLIGHT-LOG.md`) → **restart** → **this skill relaunches
every session** → `/landing` auto-runs in each tab and restores from its local `FLIGHT-LOG.md`. So takeoff
before you restart; this skill + auto-landing bring everything back.

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
Force UTF-8 for Python on Windows: prefix with `PYTHONUTF8=1`.

### Phase A — Capture & configure (sessions still open)

1. **Detect the open sessions** (reads `~/.claude/projects/*/*.jsonl` for recent `cwd`s):
   ```bash
   PYTHONUTF8=1 python "<skill>/scripts/relaunch_sessions.py" --detect --json
   ```
   Returns `[{"title": <folder-derived>, "path": <cwd>}, ...]`, most-recent first. Widen with
   `--minutes N` (default 180) if some sessions are older.

2. **Read the live tab names + order** (UI Automation — no admin):
   ```bash
   pwsh -NoProfile -File "<skill>/scripts/capture_wt_tabs.ps1"
   ```
   Returns `[{"window": "...", "tabs": ["KB","JP",...]}, ...]` in tab-strip order.

3. **Propose the tab → folder mapping** and confirm with the user. Match rules:
   - If the tab **count equals** the detected-session count, align by best name↔folder similarity
     (e.g. tab `BS` ↔ folder `...\brand-studio`, `AS` ↔ `...\acme-store`), then present the full
     ordered mapping and ask the user to confirm or correct.
   - If counts **differ** (a tab that isn't a Claude session, or a session in a background window),
     show both lists and let the user resolve — never guess silently.
   - Preserve the **tab order** from step 2 (that's the order tabs reopen in).

4. **Save the confirmed mapping** to `~/.claude/session-relaunch.json`:
   ```json
   { "sessions": [ { "title": "KB", "path": "G:\\...\\KB-CONTROL-ROOM" }, ... ] }
   ```
   Write it directly, or have the user edit it. This is the durable config — future restarts reuse it.

5. **Create the title-lock profile** (idempotent; backs up `settings.json` once):
   ```bash
   PYTHONUTF8=1 python "<skill>/scripts/relaunch_sessions.py" --setup-profile
   ```
   Adds a **hidden** WT profile `Claude Relaunch` with `suppressApplicationTitle: true`. Without this,
   Claude Code overwrites your tab titles on launch. Hidden = it won't clutter the profile dropdown but
   is still launchable by name.

6. **Hand off Phase B.** Tell the user: close your sessions (or reboot), then run the Phase B command.
   Offer `--dry-run` first. Do **not** relaunch from inside a still-open set — it would duplicate tabs.

### Phase B — Relaunch (after closing / rebooting)

```bash
PYTHONUTF8=1 python "<skill>/scripts/relaunch_sessions.py"            # from the saved config
PYTHONUTF8=1 python "<skill>/scripts/relaunch_sessions.py" --dry-run  # preview
PYTHONUTF8=1 python "<skill>/scripts/relaunch_sessions.py" --no-landing
```
Each tab launches as:
```
wt -w session-relaunch new-tab --profile "Claude Relaunch" --title <T> \
   pwsh -NoExit -Command "Set-Location -LiteralPath '<path>' && claude --dangerously-skip-permissions '/landing'"
```

## Mechanics & gotchas (encoded in the launcher — know them for debugging)

- **`&&`, not `;`**, chains the Set-Location + claude command — `wt` treats `;` as a tab separator, so a
  `;` inside `-Command` would fragment the launch. `pwsh` 7 supports `&&`.
- **Set-Location runs in `-Command`, not via `--startingDirectory`** — the user's pwsh profile often
  `Set-Location`s on startup and would override `--startingDirectory`; `-Command` runs after the profile,
  so it wins.
- **Title-lock needs the profile.** `--title` alone loses to Claude Code's own title updates unless the
  launching profile has `suppressApplicationTitle: true`. That's why step 5 exists.
- **Auto-landing** passes `/landing` as the initial prompt. Use `--no-landing` to open at a bare prompt.
- **`--detect` fallback**: with no saved config, `--detect` builds the list live from transcripts (titles
  derived from folder names — not custom tab names). Good for a quick relaunch; Phase A gives real names.

## Fast path (don't care about custom names)

```bash
PYTHONUTF8=1 python "<skill>/scripts/relaunch_sessions.py" --detect --save-config   # once
PYTHONUTF8=1 python "<skill>/scripts/relaunch_sessions.py"                          # thereafter
```

## Team sharing

The skill hardcodes no personal paths — each machine's sessions come from that machine's transcripts and
its own `~/.claude/session-relaunch.json`. Distribute via the team toolkit (`toolkit-publish`). Each
teammate runs Phase A once to record their tab names, then Phase B on every restart.
