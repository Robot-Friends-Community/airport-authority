# Changelog

All notable changes to Airport Authority are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/); this project uses date-based releases.

## [Unreleased]

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
