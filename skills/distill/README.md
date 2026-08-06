# Distill

```
 ██████╗ ██╗███████╗████████╗██╗██╗     ██╗
 ██╔══██╗██║██╔════╝╚══██╔══╝██║██║     ██║
 ██║  ██║██║███████╗   ██║   ██║██║     ██║
 ██║  ██║██║╚════██║   ██║   ██║██║     ██║
 ██████╔╝██║███████║   ██║   ██║███████╗███████╗
 ╚═════╝ ╚═╝╚══════╝   ╚═╝   ╚═╝╚══════╝╚══════╝
```

> Surface replicable patterns from work sessions and package them into skills, specialists, or SOPs.

---

## Why This Exists

Every productive Claude Code session produces more than its stated output. Patterns emerge — workflows that worked, decision frameworks that crystallized, tool chains that clicked. But they're trapped in conversation context that's about to disappear.

We kept watching good patterns evaporate. The debugging approach that would've saved an hour next time. The research workflow that produced exactly the right output. The integration pattern that just worked. All of it gone when the session ended.

Distill captures those patterns before they disappear and packages them into something reusable — a skill, a specialist, or an SOP — so the next time that situation arises, there's a proven playbook ready to go.

---

## What It Does

**A four-phase guided wizard:**

| Phase | What Happens |
|-------|-------------|
| **1. Surface** | Scans the current session for replicable patterns and presents candidates |
| **2. Refine** | Guided Q&A shapes the selected pattern into a complete specification |
| **3. Package** | Builds the deliverable — all files, correct structure, registered |
| **4. Verify** | Validates structure, confirms content, provides test instructions |

## Output Types

| Type | What it produces | Best for |
|------|----------------|----------|
| **Skill** | `SKILL.md` + `references/` + `scripts/` + `assets/` | Workflows with tools, multi-step processes |
| **Specialist** | Single `.md` file in `.claude/agents/` | Domain expertise Claude should embody |
| **SOP** | Standalone reference document | Procedures for people to follow |

---

## Quick Start

### Install

This skill ships bundled with **Airport Authority** — no separate install needed.

### Use

```
/distill              # Scan current session for patterns
/distill <topic>      # Start with a specific pattern in mind
```

Distill scans your session, surfaces pattern candidates, walks you through refinement, and builds the output. The whole process takes 2-5 minutes depending on complexity.

---

## How It Works Under the Hood

Distill is a [Claude Code skill](https://docs.anthropic.com/en/docs/claude-code/skills) — a `SKILL.md` entry point that loads detailed reference docs on demand. No compiled code, no dependencies, no build step.

The skill uses a lean entry point pattern:

```
distill/
├── SKILL.md                    # Entry point — lean, loads references on demand
├── templates/                  # Actual template files for each output type
│   ├── SKILL.template.md
│   ├── SPECIALIST.template.md
│   └── SOP.template.md
└── references/
    ├── WIZARD.md               # Full 4-phase wizard flow and Q&A framework
    └── TEMPLATES.md            # Template reference guide with examples
```

When you invoke `/distill`, Claude reads the SKILL.md, then loads the relevant reference files to execute the wizard phases.

---

## Triggers

Any of these invoke Distill:

- `/distill`
- `/distill <topic>`
- "distill this"
- "package this pattern"
- "make this reusable"
- "extract workflow"
- "capture as skill"

---

## Updating

```bash
# macOS / Linux
cd ~/.claude/skills/distill && git pull

# Windows (PowerShell)
cd "$env:USERPROFILE\.claude\skills\distill"; git pull
```

---

## Requirements

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI
- Git (for cloning — or download files manually)
- No other dependencies

---

## Related Skills

- **flight-deck** — Session handoffs + Flight Recorder build logging. The Flight Recorder's Patterns lens flags distill candidates automatically.
- **capture** — Lightweight session capture for learnings and decisions. Capture records what you learned; Distill packages what's reusable.

---

## FAQ

<details>
<summary><strong>What's the difference between a skill, specialist, and SOP?</strong></summary>

**Skills** are for workflows that Claude executes — they include tool calls, multi-step processes, and command handlers. A skill is invoked with `/skill-name`.

**Specialists** are domain experts — they define a persona and expertise boundary for Claude to embody. A specialist is loaded as an agent with deep knowledge in a specific area.

**SOPs** are for humans — they're procedures that people follow, not Claude. Use SOPs for deployment procedures, review checklists, onboarding steps.

If you're unsure, pick "Let me decide" in the wizard and Distill will recommend.

</details>

<details>
<summary><strong>What patterns are worth distilling?</strong></summary>

Anything you'd want to repeat. Common candidates:
- Multi-step workflows you found yourself explaining step by step
- Decision frameworks that crystallized ("when A, do B")
- Tool chains — specific sequences of tools/APIs that work well together
- Debugging approaches that resolved a class of problems
- Integration patterns between systems

If you caught yourself thinking "I should remember this", that's a distill candidate.

</details>

<details>
<summary><strong>Can I distill multiple patterns at once?</strong></summary>

Yes. Phase 1 surfaces all candidates and lets you select multiple. Distill runs through Phase 2 (Refine) for each pattern sequentially, checks for relationships between them, packages all patterns in Phase 3, and cross-links related packages in their reference docs.

</details>

<details>
<summary><strong>Can I update an existing skill instead of creating a new one?</strong></summary>

Yes. If you select a pattern that maps to an existing skill, Distill reads the existing skill first and presents a diff of proposed changes for your approval before writing anything.

</details>

<details>
<summary><strong>Where are the packaged files created?</strong></summary>

You choose in Phase 2. Options:
- `~/.claude/skills/<name>/` — global, available in every project
- `.claude/skills/<name>/` — project-local, scoped to the current project
- `~/.claude/agents/<name>.md` — global specialist
- `.claude/agents/<name>.md` — project-local specialist
- Custom path

Default recommendation: global for universal patterns, project-local for project-specific ones.

</details>

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines. Issues and feature requests welcome.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history.

## License

MIT — see [LICENSE](LICENSE) for details.
