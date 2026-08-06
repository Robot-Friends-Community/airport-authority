---
name: preflight
description: Aviation-themed pre-takeoff checklist. Context-aware session close-out ritual — distills learnings, captures instincts, updates memory, runs a plain-language hygiene sweep (via flight-engineer), then hands off to /takeoff, which owns all durable state (flight log + recorder). Only runs the full ritual when the session produced something worth preserving. USE WHEN user says "preflight", "pre-flight", "pre-flight check", "pre-takeoff", "wrap up", "close out the session", "capture before takeoff", "session ritual", or is about to clear context after a productive session.
---

# Preflight

A context-aware session close-out ritual. Self-assesses whether the session produced something worth preserving, then runs the appropriate capture pipeline before handing off to `/takeoff`.

---

## Commands

| Input | What happens |
|-------|-------------|
| `/preflight` | Assess session, run full ritual if warranted, then `/takeoff` |
| `/preflight quick` | Skip assessment, go straight to `/takeoff` |
| `/preflight assess` | Assess and report only — no ritual, no takeoff |
| `/preflight distill-only` | Run distill step only, skip remaining steps and takeoff |

*(`/pre-takeoff` is accepted as a legacy alias.)*

---

## Step 1: Self-Assessment

**Do not ask the user.** Read the conversation context and evaluate against the criteria below.

### Rich Session Signals (any one = run ritual)

| Signal | What to look for in context |
|--------|-----------------------------|
| Code created or modified | File writes, edits, new components, schemas, configs |
| Architecture decisions | "We decided to...", tech stack choices, pattern selections |
| Vocabulary / naming locked | Terms defined, naming conventions established, glossary updates |
| New skills, tools, or patterns | `/skill`, new workflow, library discovered, integration approach |
| Bugs found and documented | Reproduction steps, root cause identified, workarounds noted |
| Processes or workflows established | Step-by-step procedures, runbooks, SOPs |
| Multi-wave builds or agent orchestration | GSD plans executed, agents spawned, phases completed |
| Learnings future sessions would benefit from | "Next time do X", "avoid Y", "always check Z first" |

### Lightweight Session Signals (all = skip ritual)

- Only answered questions or explained concepts
- Read files but made no changes
- Single-topic Q&A under ~10 exchanges
- No code written, no decisions made, no patterns discovered
- Purely exploratory browsing with no conclusions

### When it's ambiguous

If signals are mixed (e.g., one small file changed + a few decisions), lean toward running the ritual. The cost of an unnecessary ritual is low. The cost of missing a key decision is high.

---

## Step 2: Distill (if warranted)

Identify whether a **reusable pattern** emerged this session. Ask:

- Was there a repeatable workflow or multi-step process?
- Was there a debugging investigation or diagnostic pattern?
- Was there a build, orchestration, or integration approach worth generalizing?
- Was there a prompt pattern or AI routing strategy that worked well?

**If yes:** Invoke the `distill` skill. Describe the pattern to it, or capture it manually as a session file in `~/.claude/History/Sessions/[YYYY-MM-DD]-[slug].md`.

**If no standalone pattern emerged:** Skip this step. Note "N/A" in the output.

---

## Step 3: Capture Instincts

Run `continuous-learning-v2` mentally across the session's key events. Identify and write atomic instincts for:

- Pre-flight decisions that prevented mid-build stops
- Patterns that worked and should be repeated
- Patterns that failed and should be avoided
- Model routing or tool selection decisions worth encoding
- User-specific preferences observed or confirmed

Each instinct should be:
- **Atomic** — one trigger, one action
- **Confidence-scored** — 0.3 (tentative) to 0.9 (near-certain)
- **Domain-tagged** — code-style, testing, git, debugging, orchestration, routing, workflow, etc.

Write new instincts to: `~/.claude/homunculus/instincts/personal/[slug].md`

If `continuous-learning-v2` is active and hooks are configured, note what was observed and let the system handle propagation. If running manually, write the instinct files directly.

**Graceful no-op (portability):** `continuous-learning-v2` and the `~/.claude/homunculus/` tree are an **optional** personal system — they are NOT bundled with the Airport Authority plugin. If neither is present, **skip this step cleanly**: note "instinct capture skipped — continuous-learning-v2 not installed" and move on. Never error, and never create the homunculus tree yourself.

If no instincts emerged this session: note "0 new instincts" and move on.

---

## Step 4: Update MEMORY.md

Locate the project memory file:

```
~/.claude/projects/[project-slug]/memory/MEMORY.md
```

To find the project slug: check the current working directory and match it to an existing project slug under `~/.claude/projects/`. If no match, note it and skip.

**Add or update only what changed this session:**

- New decisions locked (vocabulary, architecture, patterns)
- Build status changes (e.g., "RoboCorps Phase 4 complete")
- Open threads or pending decisions
- New tooling or integration patterns discovered
- Any correction to previously captured information

**Do not rewrite sections that didn't change.** Make surgical updates only.

If MEMORY.md doesn't exist for this project: create it with a minimal header and the session's entries.

---

## Step 5: Hygiene Sweep (delegate to flight-engineer)

> **Why this replaced the old "update Flight Recorder" step:** preflight used to append to `FLIGHT-RECORDER.md` here — but Step 6 hands off to `/takeoff`, which *also* appends (with integrity checks, `session_count`, and multi-user attribution). That was a **double-write** in two different formats. Recorder writing now belongs to `/takeoff` alone. Preflight's job before takeoff is *learning* (Steps 2–4) and *hygiene* (this step) — not durable state.

Run a plain-language project-health pass by **delegating to `flight-engineer`** (the single hygiene engine — don't reimplement its checks here). It sweeps git state, backups/PRs/CI, secrets, CLAUDE.md/README, dependencies, build, deploy drift, debt, and port hygiene; reports with 🔴/🟡/🟢 severity; **offers** safe fixes; and gates merges/deploys on explicit approval.

- **Offer fixes, never force.** Surface what it found and let the user choose. A hygiene finding does not block takeoff — takeoff can proceed with issues noted.
- **Graceful no-op:** if `flight-engineer` isn't available, do a minimal inline check (CLAUDE.md present? uncommitted pileup? a quick secret scan? README present?) and note the deeper sweep was skipped.
- Capture the one-line hygiene verdict for the Output block.

---

## Step 6: Hand Off to /takeoff

Run the standard `/takeoff` to create the `FLIGHT-LOG.<user>.md` session handoff **and** write the Flight Recorder entry. `/takeoff` owns **all** durable state — the flight log, the recorder append (with integrity + `session_count` + multi-user attribution), the central index, and any Bible/Tome sync. Preflight does not touch the recorder.

The handoff captures: objective, progress, completed items, remaining items, key decisions, blockers, uncommitted changes, and the next action.

Do not re-document what was already captured in steps 2–5. Reference those steps briefly in the Context Notes section of the flight log.

---

## Output

After completing all applicable steps, print:

```
Preflight Ritual Complete
─────────────────────────────
Session type:     Rich | Lightweight
Distilled:        [what was packaged, or N/A]
Instincts:        [N new instincts written | 0 | skipped — not installed]
MEMORY.md:        [Updated: N entries added | No changes needed | Not found]
Hygiene:          [flight-engineer verdict, e.g. 🟢 clean · 🟡 2 to fix | skipped]

Handing off to /takeoff  (writes the flight log + recorder)...
```

Then immediately proceed with `/takeoff`.

---

## Variant Behaviors

### `/preflight quick`

Skip assessment. Skip distill, instincts, memory, and hygiene steps. Go directly to `/takeoff`. Use when you know the session was lightweight and just want the handoff.

### `/preflight assess`

Run Step 1 only. Print the session type determination with supporting evidence (which signals were detected). Do not run the ritual. Do not run `/takeoff`. Useful for a sanity check before deciding whether to run the full ritual.

Output format:
```
Session Assessment
─────────────────────────────
Type: Rich | Lightweight
Confidence: High | Medium | Low

Signals detected:
+ [Signal 1 — what was observed]
+ [Signal 2 — what was observed]

Signals absent:
- [Signal type not observed]

Recommendation: [Run full ritual | Skip ritual, use /takeoff directly]
```

### `/preflight distill-only`

Run Step 2 only (distill). Identify the reusable pattern and invoke the `distill` skill or capture manually. Do not continue to instincts, memory, or flight recorder. Do not run `/takeoff`. Use when you want to extract a pattern mid-session without closing out.

---

## Integration Notes

**Relationship to `/takeoff`:** Preflight is a wrapper around `/takeoff`, not a replacement. Takeoff always runs last and owns all durable state — it creates the `FLIGHT-LOG.<user>.md` **and** writes the Flight Recorder entry. Preflight adds the *learning + hygiene* pipeline before it, and deliberately does not write the recorder itself (that would double-write).

**Relationship to `distill`:** Preflight calls distill when a reusable pattern is detected. Distill is the execution engine. Preflight is the orchestrator that decides whether to invoke it.

**Relationship to `continuous-learning-v2`:** Preflight drives the instinct capture step (optional — skipped cleanly when not installed). If the v2 system is configured with hooks, it may have already captured observations — preflight makes them explicit and ensures nothing was missed.

**Relationship to `flight-engineer`:** Preflight's Step 5 hygiene sweep delegates to flight-engineer — the single hygiene engine shared with `/takeoff`'s git step. Preflight does not reimplement those checks.

**Relationship to MEMORY.md:** Memory is the persistent project record. Preflight keeps it current so future sessions start with accurate state.

**Flight Recorder vs FLIGHT-LOG:**
- `FLIGHT-RECORDER.md` — cumulative build log, grows across sessions (shared, attributed)
- `FLIGHT-LOG.<user>.md` — single session handoff, overwritten each takeoff (per-user)

`/takeoff` writes **both**. Preflight writes neither — it does learning + hygiene, then hands off. (Older docs said "pre-takeoff writes to the recorder"; that double-write was removed — see Step 5.)

---

## Examples

**Rich session — multi-wave GSD build:**
The session executed RoboCorps Phase 4, wrote 12 files, made 3 architecture decisions. Preflight distills the pipeline runner pattern, captures instincts on Supabase realtime worker patterns, updates MEMORY.md with Phase 4 complete status, runs a flight-engineer hygiene sweep (flags 5 unpushed commits — offers to push), then hands to `/takeoff`, which writes the flight log and the recorder entry.

**Lightweight session — quick Q&A:**
The session answered questions about Supabase RLS policies. No files changed, no decisions locked, no patterns discovered. Preflight skips the ritual and goes straight to `/takeoff`.

**Mixed session — one decision, no code:**
The session resolved a naming question (locked "Human Gate" as the pipeline checkpoint term). One decision locked = Rich session. Preflight captures the vocabulary decision in MEMORY.md, writes one instinct (vocabulary-first approach for UX decisions), no distill needed, hygiene clean. Then `/takeoff`.
