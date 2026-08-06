---
name: tower
description: Read-only fleet dashboard — one control-tower view of every project's session/recorder/durable-memory status across your machine
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
---

<command-name>tower</command-name>

<objective>
Give a single, read-only "control tower" view of the whole fleet: every project Flight Deck knows about, and for each one how long since it was last touched, whether its build log is current, whether its durable memory has drifted, and who has open sessions. Nothing is modified — this is situational awareness before you decide where to fly next.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/skills/flight-deck/SKILL.md
</execution_context>

<process>

<step name="resolve-user">
Resolve the current `<user>` slug the same way takeoff/landing do (flight-deck `config.yml` `user_id` → `git config user.name` → OS username). Used to distinguish *your* open flight logs from teammates'.
</step>

<step name="gather-fleet">
**Build the project list from two sources, then dedupe by normalized path:**

1. **Central Flight Recorder index** — resolve its path from `.flight-recorder.yml central_index_path` (if in a project) or the per-user flight-deck `config.yml central_index_path`. If it resolves, read `INDEX.md`: each row is a known project (name, path, lenses, session count, last entry date).
2. **Known roots scan** — glob the standard workspace roots (e.g. `~/projects/*` and its category subdirs) for folders containing any of: `FLIGHT-LOG*.md`, `.flight-recorder.yml`, `TOME.md`, `BIBLE*.md`, `.planning/`.

If neither source yields anything, say so plainly and offer `/airport` to set up identity + the central index. Do **not** invent projects.
</step>

<step name="assess-each">
For each project (read-only — never write):
- **Last touched:** newest mtime among its `FLIGHT-LOG*.md` / recorder entry → "Nd ago".
- **Recorder freshness:** `.flight-recorder.yml session_count` + date of newest `FLIGHT-RECORDER.md` entry → 🟢 <7d · 🟡 7–30d · 🔴 >30d (or `—` if no recorder).
- **Durable-memory drift:** if `TOME.md` present, compare its front-page "Current Session" date to the newest recorder entry — flag `Tome N behind` if the recorder moved past it (the front-page-drift check from RESUME.md §2.6). Bibles: newest entry age.
- **Open sessions:** glob `FLIGHT-LOG.*.md` — list which users have a log here, marking yours; a very recent one from another user = they may be in it now.
- **Scaffolding:** GSD / task_plan / bible / tome badges.
</step>

<step name="render">
**Render the tower board** (flight-deck house style — left-anchored, emoji markers, no right border). Sort most-recently-touched first.

```
🗼 ═══════════════ CONTROL TOWER ═══════════════   (as [user])

  PROJECT              LAST    RECORDER    DURABLE MEM      SESSIONS
  ───────────────────  ──────  ──────────  ───────────────  ─────────────
  airport-authority    2h      🟢 12 · 2h  —                you
  acme-store           3d      🟡 8 · 9d   📖 Bible 4d       you · alex (5h)
  my-ecosystem         12d     🔴 3 · 31d  🗺️ Tome 4 behind  —
  scratch-thing        40d     —           —                —

  🔴 needs attention   my-ecosystem — Tome front page 4 sessions behind recorder
  👥 shared right now  acme-store — alex has a log from 5h ago
═══════════════════════════════════════════════════
```

Below the board, surface the 1–3 most actionable items (a red recorder, a drifted Tome, a teammate currently in a shared folder). End with a plain pointer: `Fly into one with:  cd <path> && /landing`.
</step>

</process>

<notes>
Strictly read-only — `/tower` never writes a file, bumps a counter, or touches a recorder. It's the pre-flight scan of the whole fleet; `/landing` is how you actually board one, `/airport` is how you set up or scaffold one.
</notes>
