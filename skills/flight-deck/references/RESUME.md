# Resume Process (landing)

The `/landing` command restores context from a handoff file and suggests the next action.

## 0. Resolve Current User (multi-user / team mode)

**Do this first.** Resolve a slug `<user>` (order, first hit wins): `~/.claude/skills/flight-deck/config.yml` `user_id` → `git config user.name` (slugified) → OS username → prompt once and save. Full rules in [MULTI-USER.md](MULTI-USER.md). You land into **your own** flight log, not a teammate's.

## 1. Locate Handoff

Check in order (project root and git root):
1. `FLIGHT-LOG.<user>.md` — **your own** handoff (multi-user mode)
2. `FLIGHT-LOG.md` — legacy single-user handoff (fallback)
3. `HANDOFF-ALLEYOOP.md` (legacy)
4. GSD: `.planning/phases/*/.continue-here.md`

**Surface teammates, don't load them.** Glob `FLIGHT-LOG.*.md` in the project root. If any belong to a user other than `<user>`, list them in the summary (name + how stale) so you know who else is in this folder — but restore context **only from your own** log. Offer to peek at a teammate's on request; never overwrite it.

If nothing is found, offer to scan recent git history or start fresh.

## 2. Load Context

Read handoff file and parse:
- Objective and progress
- Remaining work
- Key decisions (preserve these)
- Blockers (may need addressing)
- Scaffolding state

## 2.5. Query Beads (if configured)

**Check:** Does `~/.claude/beads/.beads/` exist?

If yes — query open tasks for this project and stage them for the summary:

```bash
cd ~/.claude/beads

# All open tasks for this project
bd list --json --label project:[project-name] --status open

# What's unblocked and ready right now (north star for the session)
bd ready --json
```

Store the results — they'll be injected as "Active Beads Issues" in Step 4.

If Beads doesn't exist: skip silently.

---

## 2.6. Surface Bible / Tome Status (if configured)

**Detect (exist? y/n):** `.bible-keeper.json` in project, any `BIBLE*.md` (depth ≤3), or `TOME.md` in project root.

**If none found:** don't hard-prompt mid-landing, but if the project is **appropriate** (same gate as HANDOFF.md §3.6 — `CLAUDE.md` + a real multi-session/ecosystem build) **and** not previously declined (`.flight-recorder.yml durable_memory: declined`), stage a one-line nudge for Step 5's suggested next action: `No canon memory yet — /canon-keeper (Tome) or /bible-keeper (Bible) if this project warrants one.` Otherwise skip silently.

**If found:** stage a status block for the summary in Step 4.

- **Bibles:** For each Bible file, read the last dated entry (or file mtime) → format as `Name (Nd ago)` or `Name (no entries)`
- **Tome:** Parse `lastVerified` (or `Last updated`) from `TOME.md` → format as `Last sync: Nd ago | Status: green/yellow/red`
  - green: <7 days · yellow: 7-30 days · red: >30 days
- **Tome FRONT-PAGE drift check (do this too, not just the age check).** The age of `lastVerified` misses the real drift: a Tome whose *front page* (Current Session / Open Threads) froze while sessions kept shipping through the recorder. Compare the Tome's `Current Session → Last session` date against the newest `FLIGHT-RECORDER.md` entry date. If the recorder is **newer by more than ~1 session** (or the Tome front page names a session/objective the recorder has clearly moved past), flag it: `Tome front page STALE — N sessions behind the recorder`. This is the exact failure the takeoff Tome-sync step now prevents; on an older Tome it may still be present.
- **Reality probe — catch the frozen-BOTH case (the recorder can be stale too).** The recorder-relative check above misses the worst drift: a session that closed with **no** `/takeoff`, so the recorder AND the Tome front page are both frozen while the repo kept moving. Also compare the Tome front-page date against **repo reality** — recent `git log` and beads closed since that date (`git log --since`, `bd list --status=closed`). If commits/beads advanced but **no** memory surface did, flag it: `Tome front page STALE — session closed without a /takeoff (repo moved, memory didn't)`.
- **On a keeper-enabled project (`TOME.md` present), recommend the native resume:** `/canon-keeper landing` reads the Tome's Current Session + Open Threads + Active Decisions directly (richer than FLIGHT-LOG alone). Note it in the summary.

No prompt on landing — this is passive display only. The takeoff step is where capture happens.

---

## 3. Check Flight Recorder

**Determine project root** — same directory as FLIGHT-LOG.md.

Three branches — check `.flight-recorder.yml` first:

**Branch A — `.flight-recorder.yml` exists with `enabled: true`:**
Read `FLIGHT-RECORDER.md` if it exists (may not exist on first session after setup). Read the last 1-2 entries for additional context. Note session count in the summary. If `FLIGHT-RECORDER.md` doesn't exist yet, note "recorder configured, no entries yet" — do not show the setup prompt.

**Branch B — `.flight-recorder.yml` exists with `enabled: false`:**
Skip silently. User already opted out. Do not prompt.

**Branch C — `.flight-recorder.yml` does NOT exist:**
1. Check if `CLAUDE.md` exists in the project root
2. Display the following prompt (default is Y — bare Enter = yes):

```
No Flight Recorder found for this project.

  Project root:   [absolute path]
  CLAUDE.md:      [Found ✓ | Not found]

  A Flight Recorder would track your build history across sessions.
  Files would be created here:
    [absolute path]/.flight-recorder.yml
    [absolute path]/FLIGHT-RECORDER.md

  Set one up now? [Y/n]  (Enter = Y)
```

- **Y / Enter** → run `/takeoff init-recorder` wizard (shared wizard — works from either takeoff or landing) before continuing with the landing summary
- **n** → skip, proceed with landing. Do NOT ask again this session.

## 4. Present Summary

**Formatting notes:** same conventions as the takeoff message (HANDOFF.md §7) so the pair reads as one system — `═`/`─` are fixed decorative rules, content left-anchored, no right border (emoji misalign it), emojis as consistent section markers. Fill every `[…]`. **Omit any section whose system isn't present** — never print an empty block or a "none configured" line. Map Tome status to a dot: 🟢 green (<7d) · 🟡 yellow (7–30d) · 🔴 red (>30d). The `📍` wayfinding line follows the same rules as HANDOFF.md §7 (project · abs root · branch; indent extra repos for an ecosystem).

```
🛬 ═══════════════ SESSION RESTORED ═══════════════   (as [user])

  📍 [project] · [abs project root] · [git branch, if a repo]

  📋 Objective   [objective]
  📊 Progress    [X]% · [completed]/[total] items

  ⏳ Remaining
     ☐ Item 1
     ☐ Item 2

  🧠 Decisions preserved
     • [Decision 1]
     • [Decision 2]

  🚧 Blockers    [None | list]
  📼 Recorder    [N] entries · Lenses: [Technical, Journey, Patterns]
  ─────────────────────────────────────────────
  👥 Also here   alex (2d) · sam (5h)          ← only if other FLIGHT-LOG.<user>.md exist
  🎯 Ready now   [task 1], [task 2]             ← only if Beads configured (bd ready = north star)
     Open        [N] tasks
  📖 Bibles      Marketing (2d) · Sales (—)     ← only if Bibles configured
  🗺️  Tome        sync 3d ago · 🟢 green         ← only if TOME.md exists
═══════════════════════════════════════════════════
```

**If Beads returned no open tasks:** omit the `🎯 Ready now` section entirely — don't show an empty block.
**If no Bibles/Tome detected:** omit those lines entirely.
**If no other users' flight logs exist:** omit the `👥 Also here` line entirely.
**If none of the optional systems apply:** drop the `─` divider too, so the block ends cleanly at the Recorder line.

## 5. Suggest Next Action

| Condition | Suggestion |
|-----------|------------|
| Blocker exists | Address blocker first |
| GSD phase active | Continue with /gsd:progress |
| Tome front page behind the recorder (drift check above) | `/canon-keeper audit` — reconcile the front page before trusting its threads |
| Tome status red (>30d) | `/canon-keeper audit` (stale sync) |
| Tome status yellow (7-30d) | `/canon-keeper sync` |
| Bibles configured, last entry >7d during active build | `/bible-keeper status` to review what's logged |
| Task plan exists | Continue next unchecked item |
| Otherwise | Start with "Next Action" from handoff |

Display:
```
  ➡️  Suggested next   [specific action]

  Ready to continue? [Y/n]
```
