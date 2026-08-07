---
name: flight-deck
description: Create context handoff files when clearing context and resume seamlessly in new sessions. Optionally records a Flight Recorder (black box) build log that accumulates across sessions. USE WHEN user says "takeoff", "landing", "alleyoop", "slamdunk", "handoff", "pause", "context handoff", "save state", "resume", "pick up where we left off", "continue from last session", "flight recorder", "black box", "check the black box", or is about to clear context.
---

# Flight Deck

Preserve and restore complete work state across Claude Code sessions, with an optional Flight Recorder that builds a running log of the entire project journey.

## Overview

**Two outputs, two purposes:**

| Output | Purpose | Lifespan |
|--------|---------|----------|
| `FLIGHT-LOG.<user>.md` | Session continuity — "where was I?" | Overwritten each takeoff (per user) |
| `FLIGHT-RECORDER.md` | Build log — "what happened and why?" | Accumulates across all sessions (shared, attributed) |

The flight log is short-term memory. The Flight Recorder is long-term memory.

## Multi-user / team mode

More than one person can share a project folder without their takeoffs squashing each other. Each person's session state lives in their **own** `FLIGHT-LOG.<user>.md`; the shared `FLIGHT-RECORDER.md` stays one project-wide timeline with every entry attributed `by: <user>`. The current user auto-resolves from `config.yml` → git → OS (set-once, no per-session friction). Toggle with `.flight-recorder.yml multi_user` (default on).

**One person, many terminals** on the same repo (e.g. 8 windows, each a different workstream) get an optional **lane** axis — `FLIGHT-LOG.<user>.<lane>.md` — so parallel terminals don't squash each other either. The lane is set per-terminal via the `FLIGHT_DECK_LANE` env var, or just declared in-session; no lane = unchanged single-log behavior. See [MULTI-USER.md](references/MULTI-USER.md) §2.5.

## Commands

| Command | Description |
|---------|-------------|
| `/takeoff` (or `/alleyoop`) | Create handoff + append to Flight Recorder (if configured) |
| `/takeoff debrief` | Create handoff + run full debrief interview for the Flight Recorder |
| `/takeoff init-recorder` | Configure Flight Recorder for the current project (wizard) |
| `/landing` (or `/slamdunk`) | Restore context and suggest next action |

## Durable-memory parity (keeper / bible projects)

The Flight Recorder is not the only memory surface. If a project has a **Tome** (`TOME.md`, canon-keeper) or a **Bible** (`BIBLE*.md` / `.bible-keeper.json`), takeoff keeps **those current too** — with the same auto/always-on posture as the recorder, not an opt-in prompt. Critically, the Tome has two layers: `/canon-keeper takeoff` refreshes its **front page** (Current Session / Open Threads / Next action) *and* appends history; `/canon-keeper log` only appends history and leaves the front page to rot. **At session close on a keeper project, the Tome sync uses `/canon-keeper takeoff`, never `/canon-keeper log`.** Landing checks whether the Tome front page has drifted behind the recorder, not just its age. See INTEGRATIONS.md → *Durable-memory parity*. (Keeper-native `/canon-keeper takeoff` / `/canon-keeper landing` do the whole thing Tome-first; flight-deck's `/takeoff` / `/landing` now stay in sync with the Tome rather than letting it drift.)

## References

- [HANDOFF.md](references/HANDOFF.md) — Full takeoff process: detect context, gather state, write FLIGHT-LOG.md, append to recorder
- [FLIGHT-RECORDER.md](references/FLIGHT-RECORDER.md) — Flight Recorder: setup wizard, recording modes, capture lenses, entry format, scaffolding detection
- [RESUME.md](references/RESUME.md) — Full landing process: locate handoff, load context, present summary, suggest next action
- [MULTI-USER.md](references/MULTI-USER.md) — Team mode: user identity resolution, per-user flight logs, shared attributed recorder, legacy migration, concurrency on synced folders
- [INTEGRATIONS.md](references/INTEGRATIONS.md) — Integration points (GSD, Canon Keeper, planning files, case study) and best practices
