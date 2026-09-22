# Changelog

All notable changes to Airport Authority are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/); this project uses date-based releases.

## [Unreleased]

### Changed
- Lineage: gen 1 is now [Baggage Claim](https://github.com/Robot-Friends-Community/baggage-claim) (no-look-pass renamed, 3.0.0) — the beginner edition.
- `/landing` (and `/slamdunk`) also look for a Baggage Claim `BAGGAGE.md`, so upgrading from the beginner edition needs no manual step.

### Fixed
- `/landing` / `/slamdunk` locate-handoff snippet now checks in the same order as the priority list (flight log in cwd and git root before any `BAGGAGE.md`, first hit wins, GSD's `.continue-here.md` included as the last candidate; outside a git repo the git-root probe falls back to the cwd) — previously a `./BAGGAGE.md` could shadow a git-root `FLIGHT-LOG.md` and the GSD file was printed regardless of earlier hits.

## [1.0.0] — 2026-08-05

First public release — the gen-3 successor to
[no-look-pass](https://github.com/Robot-Friends-Community/no-look-pass).

### Added

- **13 skills**: `flight-deck`, `hangar`, `preflight`, `flight-engineer`,
  `bible-keeper`, `canon-keeper`, `session-relaunch`, `cross-session-brief`,
  `beads-team-setup`, plus bundled helpers (`client-assistant`, `distill`,
  `claude-md-audit`, `folder-cleanup`) so the suite is self-contained.
- **7 commands**: `/takeoff`, `/landing`, `/alleyoop`, `/slamdunk`, `/tower`,
  `/airport`, `/flight-engineer` (alias `/mechanic`).
- **4 session-continuity hooks**: SessionStart stamps session state and nudges
  `/landing` when a flight log exists; SessionEnd warns on a missed `/takeoff`;
  PreCompact nudges `/takeoff` before context compaction; Stop nudges a checkpoint
  after long sessions.
- **Flight Recorder** — an optional, accumulating build log with per-user attribution
  and multi-user/team mode (per-user flight logs, one shared recorder).
- **Flight Engineer** — a plain-language hygiene sweep (git state, PRs/CI, secrets,
  dependencies, port hygiene) built for non-engineers; safe fixes on confirm, merges
  and deploys human-gated.
