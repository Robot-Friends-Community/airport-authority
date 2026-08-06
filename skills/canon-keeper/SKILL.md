---
name: canon-keeper
description: Scaffold a project-specific canon keeper agent with persistent log ("Keeper's Tome"). Designed for ecosystem projects with multiple repos, sites, and lore that need to stay in sync. USE WHEN user says "canon keeper", "canon check", "lore audit", "sync check", "keeper", "tome", "what's drifted", "keeper takeoff", "keeper alleyoop", "keeper handoff", "keeper landing", "keeper slamdunk", "keeper resume", or wants to maintain consistency across docs/repos. Also handles session handoffs for keeper-enabled projects.
---

# Canon Keeper

A reusable skill that scaffolds a **project-specific canon keeper agent** with its own persistent log ("The Keeper's Tome"). Designed for ecosystem projects with multiple repos, sites, and lore that need to stay in sync.

## Quick Reference

| Command | Description |
|---------|-------------|
| `/canon-keeper` | Setup wizard (first time) or status check (if already set up) |
| `/canon-keeper audit` | Full lore/doc consistency check against canon source |
| `/canon-keeper sync` | Update all sync timestamps, flag any drift |
| `/canon-keeper log [note]` | Add an entry to the Tome's sync log |
| `/canon-keeper status` | Show ecosystem health (green/yellow/red per doc) |
| `/canon-keeper takeoff` (or `alleyoop`) | Session handoff — save work state to Tome, ready for context clear |
| `/canon-keeper landing` (or `slamdunk`) | Session resume — read Tome, restore context, suggest next action |

## Behavior

### Check for Existing Setup

Before running the wizard, check if a `TOME.md` exists in the project root.

**If TOME.md exists** (keeper already set up):
- If no args or `status`: Read TOME.md and display ecosystem health summary. Show each tracked document's status (green/yellow/red based on lastVerified age). Show any Known Drift entries. Show Open Threads.
- If `audit`: Run a full consistency check — read the canon source document, then read every file in the Content Registry. Compare key facts (names, dates, terminology, product details) against canon. Report discrepancies. Update the Tome's Sync Log and Known Drift sections.
- If `sync`: Read all tracked files, update lastVerified timestamps in both TOME.md and `docs/intranet-sync.json` (if it exists). Flag any files that have changed since last verification.
- If `log [note]`: Append an entry to TOME-LOG.md Session History with today's date and the note.
- If `alleyoop`: Session handoff — save work state to Tome (see Session Handoff below).
- If `slamdunk`: Session resume — read Tome, restore context (see Session Resume below).

**If TOME.md does not exist** (first run): Proceed to setup wizard.

---

## Setup Wizard Flow

### Step 0: Principal Config (first run only)

Check if `~/.claude/canon-keeper-config.json` exists. If not, use AskUserQuestion to gather:
- **Your name**: Who maintains this project?
- **Your team/org name**: What's the team or organization?

Save to `~/.claude/canon-keeper-config.json`:
```json
{
  "principal": {
    "name": "...",
    "org": "..."
  }
}
```

On subsequent runs, load from this file and skip to Step 1.

### Step 1: The Basics

Use AskUserQuestion to gather:

- **Keeper name**: What should this keeper be called? (e.g., "Archivist", "The Scribe", "Lorekeeper")
- **Project name**: What project is this for? (e.g., "Dead Terminal")
- **Canon source**: Path to the canonical source of truth document (e.g., `docs/universe-bible.md`)
- **Project type**: Choose from:
  - **Fictional universe** — characters, lore, timeline, products (like Dead Terminal)
  - **Product ecosystem** — multiple apps/sites sharing brand, data, conventions
  - **Documentation hub** — technical docs, specs, guides that must stay consistent
  - **Custom** — user defines what "canon" means

### Step 2: Ecosystem Scan

Automatically scan the project structure:
- Find all sibling repos/subdirectories (check parent directory)
- Find all markdown docs and spec files
- Find all deployment targets (check for `.vercel/`, `vercel.json`, `netlify.toml`, etc.)
- Find existing CLAUDE.md files
- Find all `docs/` directories
- Map the ecosystem: repo -> domain -> deployment target -> local path

Present the scan results and ask the user to confirm or adjust.

### Step 3: Generate Files

Generate three files using the templates in `${CLAUDE_PLUGIN_ROOT}/skills/canon-keeper/templates/`:

#### 1. The Keeper's Tome — `{project-root}/TOME.md` (short-term memory)

Use `templates/TOME.md` as the base. Fill in:
- Keeper name, project name, date
- Ecosystem map from scan results
- Canon source path
- Content registry (all discovered markdown docs with paths and descriptions)
- Current Session set to initial setup state

#### 1b. The Tome Log — `{project-root}/TOME-LOG.md` (long-term memory)

Use `templates/TOME-LOG.md` as the base. Fill in:
- Keeper name, project name
- Initial setup entry in Session History
- Initial decision entry (keeper creation)

#### 2. The Keeper Agent — `{project-root}/.claude/agents/{keeper-name-lowercase}.md`

If no local `.claude/` directory exists, create one. Use `templates/KEEPER.md` as the base. Fill in:
- Keeper name and personality (based on project type)
- Canon source path and project type
- Ecosystem map reference
- Audit and sync procedures
- Trigger phrases

#### 3. CLAUDE.md Integration — append to `{project-root}/CLAUDE.md`

Use `templates/CLAUDE-SNIPPET.md` as the base. Fill in keeper name, canon source path, agent trigger phrases.

**IMPORTANT:** Append to existing CLAUDE.md, do not overwrite.

### Step 4: Confirmation

Display a summary:
```
CANON KEEPER SETUP COMPLETE

Keeper: [name]
Project: [project name]
Canon Source: [path]
Project Type: [type]

Files Created:
  TOME.md — The keeper's persistent log
  .claude/agents/[name].md — Keeper agent definition
  CLAUDE.md — Updated with canon keeper integration

Next Steps:
  - Review TOME.md and verify the ecosystem map
  - Run `/canon-keeper audit` for an initial consistency check
  - Run `/canon-keeper sync` after any build session
```

---

## Audit Procedure (for the generated keeper agent)

When running an audit:

1. Read the canon source document completely
2. For each file in the Content Registry:
   a. Read the file
   b. Extract key claims (names, dates, versions, terminology, product descriptions)
   c. Compare against the canon source
   d. Flag any discrepancies with severity:
      - **RED**: Direct contradiction of canon (wrong name, wrong date, wrong product)
      - **YELLOW**: Stale info (missing new content that exists in canon)
      - **GREEN**: Consistent with canon
3. Update both files:
   **TOME.md** (short-term):
   - Set each file's status in Content Registry
   - Update Known Drift with any RED/YELLOW findings
   - Update overall status (GREEN if all green, YELLOW if any yellow, RED if any red)
   **TOME-LOG.md** (long-term):
   - Add audit entry to Session History with full findings

## Sync Procedure

When running a sync:

1. For each file in the Content Registry, check file modification time
2. Update `lastVerified` timestamps in TOME.md
3. If `docs/intranet-sync.json` exists, update it too:
   ```json
   {
     "lastFullSync": "2026-02-22",
     "sections": {
       "section-id": { "file": "filename.md", "lastVerified": "2026-02-22", "status": "green" }
     }
   }
   ```
4. Log the sync in TOME-LOG.md Session History

---

## Session Handoff: `/canon-keeper takeoff` (or `alleyoop`)

One-command session handoff. Updates the Tome with current work state so the next session can pick up cleanly. **This replaces `/takeoff` (or `/alleyoop`) for keeper-enabled projects.**

### Procedure

1. **Read current TOME.md** to understand existing state

2. **Gather session state** from conversation context:
   - What was the objective this session?
   - What got completed?
   - What's still in progress or remaining?
   - Any key decisions made?
   - Any blockers or issues encountered?
   - Any files modified but not committed?

3. **Check git state** (if in a git repo):
   ```bash
   git status --porcelain
   git log -1 --oneline
   ```

4. **Update TOME.md** (short-term memory) — edit these sections:

   **Current Session** — Replace with current state:
   ```markdown
   **Last session:** [date]
   **Objective:** [what we were working on]
   **Completed:** [bullet list of what got done]
   **Uncommitted:** [file list or "None"]
   **Next action:** [specific first thing to do next session]
   ```

   **Open Threads** — Update to reflect current state:
   - Move completed items (`- [x]`) to TOME-LOG.md Completed Threads
   - Add new items for remaining/in-progress work (`- [ ]`)
   - Add the specific "start here" item at the top

   **Known Drift** — If any drift was discovered this session, add it. Move resolved drift to TOME-LOG.md.

   **Active Decisions** — If any decisions were made, add them. Keep only decisions relevant to current work; archive older ones to TOME-LOG.md.

5. **Update TOME-LOG.md** (long-term memory) — append to these sections:

   **Session History** — Add a new entry at the top:
   ```markdown
   ### [date] — session handoff
   **Objective:** [what we were working on]
   **Completed:** [bullet list of what got done]
   **Uncommitted:** [file list or "None"]
   **Next action:** [specific first thing to do next session]
   ```

   **Decision Archive** — Add any new decisions made this session

   **Completed Threads** — Move completed items from TOME.md Open Threads

   **Resolved Drift** — Move resolved drift items from TOME.md Known Drift

6. **Confirm to user:**
   ```
   Tome updated. Ready to clear context.

   Objective: [brief]
   Completed: [count] items
   Next session: [specific first action]

   To resume: /canon-keeper landing (or slamdunk)
   ```

### What makes this better than a separate handoff file

- No throwaway files — TOME.md is always current, TOME-LOG.md accumulates history
- Two-layer memory — short-term (TOME.md) stays lean, long-term (TOME-LOG.md) never loses context
- Integrated — open threads, decisions, and drift all live together in TOME.md
- Archival — completed work moves to TOME-LOG.md, not deleted
- Canonical — the Tome IS the project memory, not a copy of it

---

## Session Resume: `/canon-keeper landing` (or `slamdunk`)

One-command session resume. Reads the Tome and presents full context. **This replaces `/landing` (or `/slamdunk`) for keeper-enabled projects.**

### Procedure

1. **Locate TOME.md** — Check:
   - Current directory
   - Parent directory (monorepo root)
   - Git root

   If not found: tell user no keeper is set up, suggest `/canon-keeper` to create one or `/slamdunk` for non-keeper projects.

2. **Read TOME.md** completely (short-term — current state, open threads, active decisions)

3. **Read TOME-LOG.md** (long-term — scan recent Session History for context, check Decision Archive for relevant prior decisions)

4. **Parse and present:**

   ```
   Session Restored — [Keeper Name]'s Tome

   Project: [project name]
   Canon: [source] | Status: [GREEN/YELLOW/RED]
   Last session: [date from Current Session in TOME.md]

   Open Threads:
   - [ ] [item 1] <-- START HERE
   - [ ] [item 2]
   - [x] [completed item]

   Recent Activity:
   [From Current Session — objective, completed, next action]

   Known Drift: [None | list]

   Key Decisions: [count active] ([count total] in archive)
   ```

5. **Suggest next action** based on:

   | Condition | Suggestion |
   |-----------|------------|
   | Current Session says "Next action: X" | Start with X |
   | Known Drift has RED items | Fix drift first |
   | Open Threads has unchecked items | Continue with first unchecked |
   | Status is YELLOW/RED | Run `/canon-keeper audit` |
   | Everything green, nothing open | Ask user what to work on |

6. **Display:**
   ```
   Suggested next action: [specific action]

   Ready to continue? [Y/n]
   ```

---

## When to Use Which

| Situation | Command |
|-----------|---------|
| Ending a session on a **keeper-enabled project** | `/canon-keeper takeoff` (or `alleyoop`) |
| Starting a session on a **keeper-enabled project** | `/canon-keeper landing` (or `slamdunk`) |
| Ending a session on a **non-keeper project** | `/takeoff` (or `/alleyoop`) |
| Starting a session on a **non-keeper project** | `/landing` (or `/slamdunk`) |

The keeper versions write to TOME.md (short-term state) + TOME-LOG.md (long-term history). The original versions write to FLIGHT-LOG.md (disposable, single-use).
