---
name: alleyoop
description: Alias for /takeoff — create context handoff before clearing context
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
---

<command-name>alleyoop</command-name>

<objective>
Create `FLIGHT-LOG.md` in project root to preserve complete work state before clearing context.

Enables seamless resumption with `/landing` (or `/slamdunk`) in a fresh session.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/skills/flight-deck/SKILL.md
</execution_context>

<process>

<step name="locate-project">
**Find project root:**

```bash
git rev-parse --show-toplevel 2>/dev/null || pwd
```

Use this as the target directory for FLIGHT-LOG.md.
</step>

<step name="detect-scaffolding">
**Check for active scaffolding systems:**

```bash
# GSD
test -f .planning/STATE.md && echo "gsd"

# Planning with files
test -f task_plan.md && echo "planning-files"

# Project log
test -f PROJECT_LOG.md && echo "project-log"
```

Store detected type for later.
</step>

<step name="gather-git-state">
**Capture uncommitted changes:**

```bash
git status --porcelain 2>/dev/null || echo "Not a git repo"
git log -1 --oneline 2>/dev/null || echo "No commits"
```
</step>

<step name="gather-scaffolding-state">
**If GSD detected:**
- Read `.planning/STATE.md` for current phase/task
- Check for `.planning/phases/*/.continue-here.md`
- Note current milestone and phase number

**If planning-files detected:**
- Read `task_plan.md` for current status
- Note checked/unchecked items

**If project-log detected:**
- Read latest entry from `PROJECT_LOG.md`
</step>

<step name="gather-session-context">
**Collect from current session:**

1. **Objective** - What are we trying to accomplish?
2. **Completed** - What got done this session?
3. **Remaining** - What's left to do?
4. **Decisions** - Key choices made and why?
5. **Blockers** - Anything stuck or problematic?
6. **Next action** - Specific first thing to do when resuming?

**If any of these are unclear**, ask the user to clarify.
</step>

<step name="write-handoff">
**Write FLIGHT-LOG.md to project root:**

```markdown
---
project: [folder name]
timestamp: [ISO 8601]
scaffolding: [gsd | planning-files | project-log | none]
---

# Session Handoff

## Objective
[What we're trying to accomplish - be specific]

## Progress
**Status:** [X]% complete | [phase info if applicable]

### Completed
- [x] [Item 1]
- [x] [Item 2]

### Remaining
- [ ] [Item 3]
- [ ] [Item 4]

## Key Decisions
- **[Decision]**: [Rationale]

## Blockers
[None | list blockers with status]

## Uncommitted Changes
```
[git status output]
```

## Scaffolding State
[GSD: Phase X, Task Y of Z]
[Planning: Phase 2 of 4 complete]
[Or: None]

## Next Action
**Start with:** [Specific, actionable first step]

## Context Notes
[Mental state, approach, anything the next session needs to know]
```
</step>

<step name="confirm">
**Display confirmation:**

```
Handoff created: FLIGHT-LOG.md

Summary:
- Project: [name]
- Objective: [brief]
- Progress: [X]% | [completed]/[total] items
- Next: [action]

To resume in new session: /landing (or /slamdunk)
```
</step>

</process>

<success_criteria>
- [ ] FLIGHT-LOG.md created in project root
- [ ] All sections filled with specific content
- [ ] Next action is immediately actionable
- [ ] User knows how to resume
</success_criteria>
