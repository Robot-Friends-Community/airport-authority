---
name: claude-md-audit
description: Audit and clean CLAUDE.md files — removes redundant content, strengthens missing guardrails, and runs a short wizard to understand the project before making cuts. Based on ETH Zurich research (arxiv 2602.11988) and Anthropic's official guidance. USE WHEN user says "audit my CLAUDE.md", "clean up CLAUDE.md", "is my CLAUDE.md good", "review my context file", "CLAUDE.md audit", "claude-md-audit", or wants to improve their Claude Code context files.
---

# CLAUDE.md Audit & Clean

Audit a CLAUDE.md for redundancy and gaps, then clean it with the user's approval. Based on the ETH Zurich study on context file effectiveness and Anthropic's official guidance.

## The Core Principle

> **Remove *redundant* content. Strengthen non-obvious constraints. Don't strip — optimize.**

The research shows that context files hurt performance when they restate things Claude can already discover from the code, the README, or its training. The fix is not minimalism — it's removing noise while keeping signal.

---

## Step 1: Locate the File(s)

Check for CLAUDE.md in this order:
1. Current project directory: `./CLAUDE.md` or `./.claude/CLAUDE.md`
2. Global user config: `~/.claude/CLAUDE.md` (Windows: `~/.claude/CLAUDE.md`)
3. Ask the user if neither found: "No CLAUDE.md found. Path?"

If multiple exist, ask: "Found both a project CLAUDE.md and a global one. Which would you like to audit? (project / global / both)"

Read the file(s) silently before the conversation.

---

## Step 2: Quick Wizard (3 Questions Max)

Before auditing, ask the user 2-3 short questions to calibrate what Claude *should* already know vs. what's genuinely non-obvious. Keep it conversational, not a form.

**Ask these — but only what's unclear from reading the file:**

1. **"What's the primary language / framework?"** — helps assess whether framework conventions in the file are redundant (Claude knows Next.js) or non-obvious (niche internal tooling)

2. **"Is this a solo project or a team?"** — team projects need more in CLAUDE.md (shared conventions, onboarding info); solo projects can rely more on Claude's memory

3. **"Any tools or conventions that are non-standard?"** — specific linters, unusual test runners, internal CLIs — these are exactly what CLAUDE.md is for

Don't ask all three if the answers are already obvious from the file content.

---

## Step 3: Run the Audit

Evaluate every section using three lenses:

### Lens 1 — Redundancy Check
*Can Claude discover this without being told?*

| Content Type | Verdict |
|---|---|
| How Python imports work | ❌ Cut — Claude knows |
| What React hooks do | ❌ Cut — Claude knows |
| Project overview already in README | ❌ Cut — redundant |
| File structure that's visible in the filesystem | ❌ Cut — Claude can read it |
| "This is a TypeScript project" when tsconfig.json exists | ❌ Cut — discoverable |
| "Use Next.js App Router" when it's in the codebase | ⚠️ Trim — maybe one line is ok |
| "Run tests with: uv run pytest" | ✅ Keep — specific invocation |
| "Use MSTest, not xUnit" | ✅ Keep — non-obvious constraint |
| "Never add new npm packages without asking" | ✅ Keep — rule, not discoverable |
| "Auth lives in /src/auth/ — don't touch without review" | ✅ Keep — non-obvious guardrail |

### Lens 2 — Signal Check
*Is this load-bearing for every session?*

Keep in CLAUDE.md:
- Build/test/lint commands (exact invocations)
- Hard constraints that differ from defaults
- Non-obvious architecture decisions
- Safety rules (e.g., "never run taskkill /F /IM node.exe")
- Pointers to deeper docs (`See /docs/auth.md for auth patterns`)

Move to referenced docs or cut:
- Detailed architecture explanations (put in `/docs/`, reference with one line)
- Long examples that are in the codebase already
- Historical context ("we switched from X to Y because...")

### Lens 3 — Coverage Check
*What's missing that SHOULD be here?*

Flag if not present:
- Primary build/run/test commands
- Any non-standard tooling
- Hard rules about what NOT to do
- Key files/directories that are off-limits or load-bearing
- Preferred patterns when Claude has multiple valid options

---

## Step 4: Present the Audit Report

Show a structured report before touching anything:

```
## CLAUDE.md Audit Report
**File:** [path]  **Lines:** [n]  **Est. tokens:** [n]

### ❌ Cut (redundant — Claude already knows this)
- Line 12-18: Project overview (already in README)
- Line 34: "This uses TypeScript" (discoverable from tsconfig.json)
- Line 67-72: Explanation of how async/await works

### ⚠️ Trim (keep the rule, cut the explanation)
- Line 45-52: Auth section → keep the constraint, cut the 6-line explanation
- Line 89-94: Testing section → "run pytest" is enough, cut the why

### ✅ Keep (genuinely non-obvious or load-bearing)
- Line 1-8: Safety rules (non-negotiable)
- Line 23-28: Build commands (specific invocations)
- Line 56: "Never add dependencies without approval"

### ➕ Add (missing high-value content)
- Primary run command not found
- No mention of the custom linter config

**Summary:** Remove ~[n] lines, trim ~[n] lines, add ~[n] lines.
Estimated token reduction: ~[n]%
```

---

## Step 5: Get Approval

Ask: "Want me to apply these changes? I'll show you the result before saving. (yes / show me first / skip some)"

If "show me first" — render the proposed cleaned version in a code block for review before editing.

If "skip some" — go through the ❌ Cut list item by item for approval.

**Never edit without explicit approval.**

---

## Step 6: Apply & Confirm

1. Edit the file with approved changes
2. Show a brief summary: "Removed X lines, trimmed Y sections, added Z items. File is now N lines."
3. Offer: "Want me to also update the project CLAUDE.md?" (if only global was audited, or vice versa)

---

## Reference: What CLAUDE.md Should Contain (Anthropic Guidance)

A well-formed CLAUDE.md is a **focused project constitution**, not a sparse fence. Target ~50-200 lines. Include:

```markdown
# [Project Name] — Claude Code Context

## Build & Run
- Install: [command]
- Dev: [command]
- Test: [command]
- Lint: [command]

## Hard Rules
- [Things Claude must never do]
- [Non-obvious constraints]

## Architecture
- [1-2 sentences on structure]
- See /docs/[file].md for [topic]

## Key Files
- /src/auth/ — authentication, don't modify without review
- /src/api/ — all endpoints live here

## Conventions
- [Non-standard patterns that differ from framework defaults]
- [Preferred approach when multiple valid options exist]
```

**The ~300 line limit is about context window efficiency, not scope. Dense + focused beats sparse.**

---

## Research Basis

- **Paper:** "Evaluating AGENTS.md: Are Repository-Level Context Files Helpful for Coding Agents?" — ETH Zurich / Logicstar.ai, arXiv 2602.11988, Feb 2026
- **Finding:** Auto-generated context files: -0.5% perf on SWE-Bench, +20% cost. Developer-written: +4% avg when non-redundant
- **Key insight:** Redundancy is the problem, not comprehensiveness. Context files help most in poorly-documented repos
- **Anthropic guidance:** CLAUDE.md as living document, updated continuously, with concise but comprehensive project constitution structure
