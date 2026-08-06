---
name: flight-engineer
description: Plain-language project-health sweep — keeps a project airworthy, fixes the safe stuff for you, gates merges/deploys on your approval
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
  - Skill
---

<command-name>flight-engineer</command-name>

<aliases>/mechanic</aliases>

<objective>
Run the Flight Engineer hygiene sweep on the current project: diagnose git state, backups/PRs/CI, secrets, docs, dependencies, build, deploy drift, and debt; report in plain language with severity; execute the safe forward-only fixes on confirmation; and gate merges + deploys on explicit human approval.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/skills/flight-engineer/SKILL.md
</execution_context>

<operating_model>
This user does not read code or run commands. Claude executes the mechanics. The human approves only the two irreversible, outward-facing gates — MERGE and DEPLOY — and Claude runs those on an explicit yes. Never auto-run destructive git (force-push, history rewrite, hard reset, deletions); surface them as suggestions only. Follow the full contract, sweep, severity language, output format, and safety rules in the SKILL.md above.
</operating_model>
