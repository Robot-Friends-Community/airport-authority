---
name: cross-session-brief
description: Write a structured integration/sync document between two Claude sessions working on different but related projects in the same ecosystem. USE WHEN user says "cross-session brief", "sync sessions", "brief the other session", "leave a note for the other Claude", "sync two projects", "write an integration brief", or when two sessions are building things that need to talk to each other.
---

# Cross-Session Brief

When two Claude sessions are building related projects simultaneously, neither session knows what the other is doing. This skill bridges that gap — one session explores the other project, synthesizes the integration seams, and writes a structured brief to a shared location. The other session reads it on next load.

**Problem it solves:** You're building Project A in one session and Project B in another. They need to integrate. Without this, you'd have to manually relay context, or the sessions would build incompatible interfaces.

**The key move:** Instead of asking the user to explain Project B to Session A, Session A reads Project B directly and writes the brief itself.

---

## When to Use

- Two Claude sessions working on different repos/projects in the same ecosystem
- End-of-session before takeoff — leave context for the other session
- When a new integration seam is discovered mid-session
- When you realize two projects have overlapping architecture decisions

---

## Workflow

### Step 1: Explore the other project

Use the Explore agent to deeply read the other project:

```
Agent(subagent_type=Explore):
  "Explore [Project B path] thoroughly. I need to understand:
   1. What is this project? What does it do?
   2. What's the tech stack?
   3. What APIs/interfaces does it expose?
   4. What's the storage layer?
   5. What's built vs planned?
   6. Any README, CLAUDE.md, or planning docs?"
```

### Step 2: Synthesize integration seams

From the exploration, identify:
- **Already connected** — things that work together without code changes
- **Easy wins** — 1-2 line changes to wire up
- **Handoff points** — where data flows from one project to the other
- **Shared infrastructure** — ports, services, databases both projects use
- **Design language** — if both have UIs, what should be shared

### Step 3: Write the brief

Write `[PROJECT-B-ROOT]/[PROJECT-A]-INTEGRATION-BRIEF.md` with:

```markdown
# [Project A] ↔ [Project B] Integration Brief

> Written by the [Project A] session ([date]) for the [Project B] session to pick up.
> Context: [one sentence explaining why this exists]

---

## What [Project A] Is (Current State)
[Architecture, stack, what's built, key files]

## Strategic Decisions Made
[Product direction, deployment choices, version roadmap]

## Integration Points to Build
### 1. [Integration point name] (Already Wired / Easy Win / Needs Build)
[Exact steps, file paths, code snippets]

### 2. [Next point]...

## Design Language: [What to share]
[Tokens, patterns, components to port]

## Files to Reference
[Exact paths the other session should read]

## Recommended Build Order
[Sequenced steps, what unblocks what]

## Quick Contact Between Sessions
[Where to find more context, memory files, git log commands]
```

### Step 4: Commit it

```bash
git add [PROJECT-B-ROOT]/[PROJECT-A]-INTEGRATION-BRIEF.md
git commit -m "docs: cross-session brief from [Project A] session"
```

Or if Project B is a separate repo, just write the file — the other session will see it.

---

## Ecosystem Sync Ultra Combo

For a full end-of-session ecosystem sync ritual, chain these:

```
1. Explore agent     → read the other project(s)
2. cross-session-brief → write brief to shared location
3. /distill          → capture any new patterns discovered
4. memory update     → save key decisions and IDs to MEMORY.md
5. /takeoff          → session handoff with full state
```

This is the "ecosystem sync" pattern — use it before any session clear when you're working in a multi-project environment.

---

## Brief Quality Checklist

A good brief answers these questions for the receiving session:

- [ ] What is the other project and what does it do? (no prior knowledge assumed)
- [ ] What decisions are already locked that the other session must respect?
- [ ] What are the exact integration seams, with file paths and code snippets?
- [ ] What should be shared (design tokens, ports, services, schemas)?
- [ ] What's the recommended build order — what unblocks what?
- [ ] Where are the key files to read?
- [ ] How can the other session find more context if they need it?

---

## Real Example

**Situation:** the planner session discovered data-service while planning deployment.

**What happened:**
1. the planner session ran Explore agent on `~/projects/data-service`
2. Discovered: same Brain sidecar port (8766), overlapping UI views, graduation handoff opportunity
3. Wrote `~/projects/data-service`
4. data-service session reads it on next load — knows exactly what the planner expects, what design tokens to use, what the graduation handoff looks like

**Key insight from this example:** The Brain sidecar was already wired — no code change needed. The brief surfaced it. Without it, both sessions might have built duplicate solutions.

---

## Tips

- **Write to the OTHER project's root** — that's where the other session will look
- **No prior knowledge assumed** — write as if the other session has never heard of your project
- **Include exact file paths** — don't say "the server file," say `dashboard/server.py`
- **Flag what's already wired** — saves the other session from building something that works automatically
- **Date it** — include the session date so the other session knows how fresh it is
