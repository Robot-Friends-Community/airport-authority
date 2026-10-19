# Resume Process (landing)

The `/landing` command restores context from a handoff file and suggests the next action.

## 0. Resolve Current User + Lane (multi-user / team mode)

**Do this first.** Resolve a slug `<user>` (order, first hit wins): `~/.claude/skills/flight-deck/config.yml` `user_id` → `git config user.name` (slugified) → OS username → prompt once and save. Full rules in [MULTI-USER.md](MULTI-USER.md). You land into **your own** flight log, not a teammate's.

Then resolve an optional `<lane>` (for one person running many terminals on the same repo): `FLIGHT_DECK_LANE` env var → a lane declared this session → else no lane. See [MULTI-USER.md](MULTI-USER.md) §2.5. With a lane set, you land into **your lane's** log.

## 1. Locate Handoff

Check in order (project root and git root):
1. `FLIGHT-LOG.<user>.<lane>.md` — **your lane's** handoff (only when a lane is resolved)
2. `FLIGHT-LOG.<user>.md` — **your own** handoff (multi-user mode)
3. `FLIGHT-LOG.md` — legacy single-user handoff (fallback). If it's a **router/index** (lists/points at other flight logs rather than a single session), follow its pointers instead of loading it as a handoff — do **not** treat it as your session state.
4. `BAGGAGE.md` — a [Baggage Claim](https://github.com/Robot-Friends-Community/baggage-claim) bag (the beginner edition). Read it as a handoff; on the next `/takeoff` write a `FLIGHT-LOG` instead and offer to remove the bag.
5. `HANDOFF-ALLEYOOP.md` (legacy no-look-pass)
6. GSD: `.planning/phases/*/.continue-here.md`

**Surface the whole board, don't load it.** Glob `FLIGHT-LOG.*` in the project root (separator `[.-]`, so lane logs and hand-rolled dash-named logs are both visible). List any belonging to **other lanes of yours** or to **other users** in the summary (name/lane + how stale) so you see everything live in this folder — but restore context **only from your own** resolved log. Offer to peek at another on request; never overwrite it.

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

## 2.6.5. Catch up Open Loops + the sidebar mailbox (if `~/.claude/skills/sidebar/scripts/sidebar.py` exists)

**If the script is absent, skip this entire step silently.** `sidebar` is an OPTIONAL companion
skill, not a flight-deck dependency — flight-deck never bundles it. The one exception: if the
flight log *does* carry an `## Open Loops` section, a peer is owed a reply and you cannot
reconcile it, so say `Mailbox: sidebar not installed — N loops carried, unreconciled` in the
banner rather than dropping them.

**Do this BEFORE listeners.** A listener is a live wire; the sidebar log is durable state that is
already waiting. Read the mailbox first so you do not re-ask something that was answered while the
session was down.

**Resolve `<my-slug>` first.** It is the SESSION slug this session announced on the bus — the
`slug` on the flight log's `## Listeners` bus line, or the `reply to` value on its `## Open Loops`
entries. It is **NOT** the `<user>` identity resolved in §0: `<user>` is a person (`your-team`),
`<my-slug>` is a session (`master-crm`, `rfos`). Getting it wrong is not a loud failure — it exits
0 and prints "no new messages" while the mail sits unread, so **never guess it**. If the flight log
names no slug and this session never sent a sidebar message, there is no mailbox: skip the step.

1. **Count first, then drain** — `python ~/.claude/skills/sidebar/scripts/sidebar.py peek <my-slug>`
   for the banner count (it does NOT consume the watermark), then `... sidebar.py read <my-slug>`.
   **`read` advances the watermark permanently** — copy its output into the `📬 Mailbox` row
   immediately; re-running it will not show the same messages again.
   This is the MAILBOX; native `SendMessage` is only the DOORBELL. A doorbell missed during `/clear`
   costs latency, not content — but only if you actually read here. (Measured 2026-09-23: the
   doorbell reaches an idle peer unprompted in ~35s, yet a 4-day-old session had already lost a
   message to context compaction. Context loss is certain; design for it.)
2. **Re-surface outstanding asks** — `... sidebar.py loops <my-slug>`, and reconcile against the
   flight log's `## Open Loops`. For each one still open:
   - Check the peer is still alive with `ListAgents`. **If it is gone, say so in the banner —
     never drop it silently.** Silence from a dead session is not an answer. If `ListAgents` is not
     available to the running surface, report `peer liveness unknown` — never assume alive.
   - If the answer arrived in step 1, **close it** (`sidebar.py close <id> --me <my-slug>`) and
     drop it from the flight log. A stale loop that reads as live is worse than none.
   - If still unanswered, apply its **On silence** clause — which was decided when it was sent,
     precisely so absence cannot quietly become assent.
**A non-zero exit from `sidebar.py` is a SKIP, never a STOP — with ONE carved-out exception.**
This step opens with "before listeners" — an agent that halts here never reaches §2.7 and silently
drops the mesh, which is the exact failure §2.7 exists to prevent. Never let an optional companion
block a required step.

> ⚠️ **EXIT CODE 3 IS THE EXCEPTION — REPORT IT, NEVER SKIP IT.** Exit 3 means **UNKNOWN SLUG**:
> the slug you passed has never appeared in the log and owns no watermark, so the read proved
> nothing. It is *not* "sidebar is missing" and it is *not* "no mail." Skipping it silently
> rebuilds the exact false all-clear the guard exists to break — on 2026-09-23 a peer session ran
> `peek RFOS` (a bus slug it found in its own flight log), got a clean `0`, and told its user
> "mailbox clean" while a real message sat unread under its actual slug.
>
> On exit 3: **do not print a mailbox count at all.** Put `📬 Mailbox ⚠️ UNKNOWN SLUG '<slug>' —
> NOT verified clean` in the banner, with the known-slug list the script prints on stderr, then
> resolve the right slug and re-run. Continue to §2.7 either way — report, don't halt.
> Only pass `--new` when the slug is genuinely first-run; it suppresses the guard.

Every other non-zero (script absent, Python missing, a broken log line) stays a silent skip.

3. **Graduate a stale loop into a bead.** If a loop has survived more than one session unanswered,
   file it with `bd` and close the sidebar loop pointing at the bead. Files are good at *what
   happened*; beads are good at *this is owed and tracked*. Do not let it rot in a flight log.

Surface the result in the banner as `📬 Mailbox` (new messages drained) and `🔁 Open Loops`.

## 2.6.6. Run the `doctor` (if the `combined-arms` plugin is installed)

**Gate on the plugin REGISTRATION, never on a file path.** `combined-arms` is a plugin (0.1.0+,
2026-10-06) and lives wherever Claude Code installed it — the path changes with every version. The
old gate (`if ~/.claude/skills/combined-arms/scripts/doctor.py exists`) became a silent skip the
moment the kit was packaged: absence of a file read as "not installed" and the doctor quietly
stopped running at every landing. So:

```bash
python - <<'EOF'
import json, os, subprocess, sys
reg = os.path.expanduser("~/.claude/plugins/installed_plugins.json")
if not os.path.exists(reg):
    print("SKIP: no plugins installed"); sys.exit(0)
try:
    entry = json.load(open(reg, encoding="utf-8"))["plugins"].get("combined-arms@combined-arms")
except Exception as exc:
    # A registry that exists but cannot be read proves NOTHING about whether the
    # kit is installed. Treating it as "not installed" is a silent skip.
    print("BROKEN: cannot read %s (%s)" % (reg, type(exc).__name__)); sys.exit(2)
if not entry:
    print("SKIP: combined-arms not installed"); sys.exit(0)
doctor = os.path.join(entry[0]["installPath"], "scripts", "doctor.py")
if not os.path.exists(doctor):
    print("BROKEN: combined-arms is registered but its doctor is missing at " + doctor); sys.exit(2)
sys.exit(subprocess.call([sys.executable, doctor]))
EOF
```

- **Not registered** → skip silently; it is an optional companion, exactly like `sidebar` above.
- **Registered but the doctor is missing** → that is a broken install, **not** an absent one.
  Report it as `🩺 Doctor ⚠️ SELF-CHECK BROKEN` below — never as a skip.

(Inside a session with the plugin loaded, `/ca-doctor` runs the same thing.)

Runs in a throwaway sandbox: it never touches the live message store, the live mesh, or the live
context-guard state. Takes a few seconds.

**Why landing is the right moment (R57).** Everything §2.6.5 just did — a mailbox count, a loop
reconciliation, a "clean" — is only worth what the guards underneath it are worth. Several of those
guards fail **byte-identically to success**: an unknown slug used to return a clean `0`, and a
context guard with an unresolvable window used to pass in silence. **A mailbox count from an
unverified store is not evidence, and no mesh claim should be trusted without this.**

Report in the banner as `🩺 Doctor`:

- **exit 0** → `🩺 Doctor  N/N guards hold (two-sided)` (N is whatever the doctor counts — it grows).
- **exit 1** → a guard did not hold, **or** a check could not run both sides. Name the specific
  guard and say what it no longer protects. **Do not soften this into a warning** — and do not let
  a green mailbox line sit next to it unqualified: if the drain guard is the one that failed,
  §2.6.5's result is exactly what stopped being trustworthy.
- **exit 2** → the doctor itself is broken. Report `🩺 Doctor ⚠️ SELF-CHECK BROKEN — guards NOT
  verified`, and **never** render this as a pass. An unrunnable check is not a passing check.

Unlike §2.6.5's exit 3, a non-zero here is **never** a silent skip — a doctor you are allowed to
ignore is a doctor that certifies nothing.

**Once a week, or before installing anything, run `--self-test`.** It re-runs every check against
a stub with no guards in it and requires that all of them fail. KORUS's framing is the reason:
*"you run it BEFORE installing anything as well as after."* A passing doctor that cannot fail is
the exact thing it exists to prevent.

## 2.7. Re-arm Listeners (if the flight log has a `## Listeners` section)

A `/clear` kills every `/loop` and every background task the previous session had running. The
flight log's `## Listeners` section is the only record — so landing, not the human, restarts them.

1. **Catch up synchronously first.** For a bus listener: `bash ~/.claude/skills/session-bus/scripts/bus.sh watch <slug> <thread_ts ...>`.
   Stage anything new for the banner (`📡 Bus`) — deposits made while the session was down are
   durable and this is where they surface. Act on them *after* the summary.
2. **Re-arm each `re-arm:` line** via Bash with `run_in_background: true`. `listen.sh` exits (and
   wakes the session) on the first activity that isn't the session's own post, or after its
   9-minute window (the Bash tool silently kills background tasks at 10 min) — on an "elapsed"
   wake, re-arm it while the session is still building/waiting; pass `timeout: 600000`.
3. **Post a `status` ping** on the bus thread so peers know the session is back and listening.
4. **Skip a listener whose `stand down when:` condition is already met** (the awaited reply is in
   the catch-up read) — say so in the banner instead of re-arming.

Banner lines (omit both if the section doesn't exist):

```
  📡 Bus         [N new since takeoff — one line each]
  📡 Listeners   bus `slug` on N threads · re-armed ✓   |   stood down: <why>
```

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
  📬 Mailbox     [N drained from the sidebar log — one line each]      ← omit if none
  🔁 Open Loops  [N awaiting reply · peer · what it blocks · peer alive?]  ← omit if none
  🩺 Doctor      N/N guards hold (two-sided)    ← only if combined-arms installed; NEVER omit
                                                  on a non-zero exit — name the guard that fell
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
**If none of the optional systems apply:** drop the `─` divider too, so the block ends cleanly at the last line that applies.

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
