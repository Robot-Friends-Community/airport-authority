# Flight Recorder

The Flight Recorder is an optional black box that accumulates across sessions — capturing decisions, patterns, and the project journey in a running `FLIGHT-RECORDER.md` log.

## First-Time Setup Wizard

The first time `/takeoff` is run in a project without `.flight-recorder.yml`, offer setup:

```
Flight Recorder not configured for this project.
Want to record the build? [Y/n/never]
```

- **Y** — continue to wizard
- **n** — skip this time, ask again next takeoff
- **never** — create `.flight-recorder.yml` with `enabled: false`, never ask again

### Wizard Step 1: Recording Mode

```
Default recording mode:

  1. Auto      — Zero friction. Claude extracts from the session silently.
                  You won't even notice. (recommended)
  2. Checkpoint — Claude asks 2-3 quick questions before recording. ~30 seconds.
  3. Debrief    — Structured interview capturing your voice and reasoning. ~2-3 min.
                  Best for milestone moments.

You can always override per-session with /takeoff debrief

Choose default [1/2/3]:
```

### Wizard Step 2: Lenses (multi-select)

```
What should the recorder capture? Pick one or more:

  [T] Technical  — Architecture decisions, tech choices, implementation gotchas
  [J] Journey    — The story arc from idea to execution, pivots, eureka moments
  [P] Patterns   — Reusable workflows, techniques that worked, automation opportunities
  [B] Business   — Timeline, outcomes, metrics, ROI, resource usage
  [L] Learning   — What was learned, skills developed, knowledge gaps discovered

Enter letters (e.g., TJP for Technical + Journey + Patterns):
```

### Wizard Step 3: Confirm & Save

Save to `.flight-recorder.yml`:

```yaml
enabled: true
default_mode: auto          # auto | checkpoint | debrief
lenses:
  - technical
  - journey
  - patterns
created: 2026-02-25T14:30:00Z
session_count: 0
```

Display:
```
Flight Recorder configured.
Lenses: Technical, Journey, Patterns
Default mode: Auto

Every /takeoff will now append to FLIGHT-RECORDER.md
Override anytime with /takeoff debrief
```

---

## Recording Modes

### Auto Mode (zero friction)

Claude silently extracts from session context. No questions asked.

**What Auto captures per lens:**

| Lens | Auto-extracted from session |
|------|---------------------------|
| Technical | Files modified, tech decisions made, architecture changes, error resolutions |
| Journey | Objective for the session, what was attempted, pivots, how the session ended |
| Patterns | Repeated workflows, tool chains, approaches that could be reused |
| Business | Session duration (approx), features delivered, blockers that cost time |
| Learning | New concepts encountered, skills exercised, knowledge gaps |

### Checkpoint Mode (~30 seconds)

Same as Auto, plus 2-3 targeted questions based on active lenses.

**Example questions by lens:**

| Lens | Example questions |
|------|-------------------|
| Technical | "You switched from X to Y — what drove that?" |
| Journey | "How does this session move the overall project forward?" |
| Patterns | "Would this approach work on other projects, or was it specific to this one?" |
| Business | "Any scope changes or timeline impacts this session?" |
| Learning | "Anything you'd do differently if you started this session over?" |

### Debrief Mode (~2-3 minutes)

A structured interview capturing your voice and reasoning.

**Debrief flow:**

1. **Session summary** — Claude presents what it observed, asks for corrections
2. **Lens-specific questions** — 1-2 questions per active lens
3. **Reflection** — "Anything else important about this session that I might have missed?"
4. **Pattern flag** — "Did anything feel like it could become a reusable workflow or skill?"

---

## Debrief Auto-Suggestion

When the default mode is Auto or Checkpoint, Claude detects significant events and suggests escalating:

**Trigger signals:**

| Signal | Detection |
|--------|-----------|
| Architecture pivot | Tech stack change, major dependency swap, approach reversal |
| Major blocker resolved | Extended debugging session that reached resolution |
| GSD phase complete | `.planning/STATE.md` shows phase transition |
| Feature milestone | Significant functionality shipped or deployed |
| First session on project | No prior entries in `FLIGHT-RECORDER.md` |
| Scope change | Objective shifted significantly from session start |

**Suggestion format:**
```
Looks like a significant [event type].
Run a debrief instead of the usual auto recording? [Y/n]
```

One suggestion per session max.

---

## Entry Format

Each entry in `FLIGHT-RECORDER.md` — only active lenses get sections. The recorder is **one shared file** for the whole project; every entry is attributed with `by: <user>` (multi-user / team mode — see [MULTI-USER.md](MULTI-USER.md)). Omit `by:` only in legacy `multi_user: false` mode.

```markdown
---

## Session N | YYYY-MM-DDTHH:MMZ | by: <user> | [mode: auto/checkpoint/debrief]

**Objective:** [What this session set out to do]
**Outcome:** [What actually happened]

### Technical
- [Architecture decisions, tech choices, files changed, gotchas]

### Journey
- [Where this fits in the overall build, pivots, momentum]

### Patterns
- [Reusable workflows, techniques, tool chains worth extracting]
- **Distill candidate:** [Yes/No — if yes, brief description]

### Business
- [Timeline impact, features delivered, scope changes]

### Learning
- [New knowledge, skills exercised, gaps discovered]
```

**Entry length:** Auto: 5-15 lines. Checkpoint: 10-25 lines. Debrief: 20-50 lines.

---

## File Header

Written once at creation:

```markdown
# Flight Recorder — [Project Name]

> Black box build log. Each session appends an entry below.
> Check the recorder to understand what happened and why.

**Created:** [ISO date]
**Lenses:** [Technical, Journey, Patterns]
**Default mode:** [Auto]

---
```

---

## Scaffolding Detection

| Scaffolding | Detection | What to include |
|-------------|-----------|-----------------|
| GSD | `.planning/STATE.md` exists | Current phase, task number, phase transition events |
| Canon Keeper | `TOME.md` exists | Note both files, different purposes |
| Planning files | `task_plan.md` exists | Current phase status, completed items |

**Canon Keeper projects:** If `TOME.md` exists, Flight Recorder still creates its own `FLIGHT-RECORDER.md`. Add to FR header:

```markdown
> **Note:** This project also has a Canon Keeper (TOME.md).
> The Tome tracks canon consistency. This recorder tracks the build journey.
```

---

## Flight Recorder Index (Optional)

Central cross-project index tracking all recorders:

```markdown
| Project | Path | Lenses | Sessions | Last Entry | Mode |
|---------|------|--------|----------|------------|------|
| my-app  | projects/my-app/ | Technical, Journey | 5 | 2026-02-25 | auto |
```

After every `/takeoff` with a recorder entry, the skill updates the index: find/update the current project row, or append a new row if not present.
