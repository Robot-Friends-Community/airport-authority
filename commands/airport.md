---
name: airport
description: Guided concierge — first-run identity setup, then routes you to the right Airport Authority action for wherever you are (empty folder, fresh project, or a scaffolded one)
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
  - Skill
---

<command-name>airport</command-name>

<objective>
Be the friendly front desk for the whole Airport Authority suite. On first run, set up the traveler's identity once (so takeoff/landing/tower work per-user). Then look at where they are and route them — an empty folder gets scaffolded, a fresh project gets set up, a scaffolded one gets the right next action — without making them memorize which command does what.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/skills/flight-deck/SKILL.md
</execution_context>

<process>

<step name="first-run-identity">
**Check whether identity is set up** — flight-deck `config.yml` with a `user_id`. If missing, this is a first run:

1. Resolve a suggested slug (`git config user.name` → OS username), confirm it with AskUserQuestion, and save `user_id` to `~/.claude/skills/flight-deck/config.yml` — **create the `~/.claude/skills/flight-deck/` directory first if it doesn't exist** (in a plugin-only install it won't pre-exist). This home-anchored path is user-writable and is where flight-deck reads identity in both plugin and standalone installs (never write config into `${CLAUDE_PLUGIN_ROOT}`, which may be read-only).
2. Offer to set the **central Flight Recorder index** path (`central_index_path`) so `/tower` can see the whole fleet — suggest the standard location, let them accept or change, save it. Skippable.
3. Offer to **enable the Airport Authority hooks** (SessionStart flight-status, PreCompact/Stop takeoff nudges) if not already active. Explain in one line what each does; default yes but skippable.

If identity already exists, skip silently to routing.
</step>

<step name="classify-location">
**Look at the current folder and classify it** (read-only):
- **Empty / near-empty** — no `CLAUDE.md`, no `.git`, no source → *unscaffolded*.
- **Fresh project** — has code/`.git` but no Flight Deck surfaces (no `FLIGHT-LOG*.md`, `.flight-recorder.yml`, `TOME.md`, `BIBLE*.md`) → *unmanaged*.
- **Scaffolded** — already has one or more Flight Deck / durable-memory surfaces → *managed*.
</step>

<step name="route">
**Route by classification** using AskUserQuestion so the traveler just picks a destination:

**Unscaffolded (empty folder)** → offer to build it out via **`hangar`**. Walk hangar's forks with them: is this a **client** project, an **ecosystem** (multi-repo/site), or a **standalone/org** project? Pass the answer to hangar. **Offer `beads-team-setup` as an optional stop** if more than one person will touch it (team task board). Then hangar wires the real surfaces (flight-deck, bible/tome, beads, client CoS, env/secrets).

**Unmanaged (fresh project, no surfaces)** → offer the lighter-weight setup: initialize a Flight Recorder (`/takeoff init-recorder`), optionally a Tome/Bible if it's canon-bearing, and a first `/takeoff` to lay down a flight log. Don't force hangar's full scaffold on an existing codebase.

**Managed (scaffolded)** → present the action menu for where they are:
- `/landing` — resume from your flight log (recommend if a `FLIGHT-LOG.<user>.md` exists)
- `/takeoff` — save state before you clear
- `/tower` — see the whole fleet, not just here
- `/preflight` — hygiene + learning pass before a takeoff
- `/flight-engineer` — deep project-health sweep

Recommend the most likely one based on state (e.g. an open flight log → `/landing`; lots of uncommitted work → `/flight-engineer` then `/takeoff`).
</step>

<step name="handoff">
Delegate the chosen action to its own skill/command (don't reimplement it here). `/airport` is the concierge — it points, sets up identity, and routes; the specialized commands do the work.
</step>

</process>

<notes>
`/airport` is the one command a new teammate can run without knowing anything else — it bootstraps their identity and hands them the right next step. Everything it offers is skippable; it never forces scaffolding on a folder that doesn't want it.
</notes>
