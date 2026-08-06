# Distill Wizard

Four-phase guided flow to surface session patterns and package them into reusable artifacts.

## Invocation

```
/distill              # Start wizard from current session
/distill <topic>      # Start with a specific pattern in mind
```

## Phase 1: Surface

Scan the current session and identify candidate patterns worth packaging.

### What to Look For

| Signal | Example |
|--------|---------|
| Multi-step workflows | "First I did X, then Y, then Z..." |
| Decision frameworks | "When A, do B. When C, do D." |
| Tool chains | Specific sequence of tools/APIs used together |
| Repeated processes | Same approach used across multiple tasks |
| Hard-won knowledge | Debugging insight, non-obvious configuration |
| SOPs that emerged | Step-by-step procedures that crystallized |
| Integration patterns | How systems were wired together |

### Present Candidates

After scanning, present findings to the user:

```
Patterns detected in this session:

1. [Pattern name] — [1-line description]
   Type: workflow | decision-framework | tool-chain | SOP | integration
   Complexity: low | medium | high

2. [Pattern name] — [1-line description]
   ...

Which pattern(s) would you like to distill?
```

Use AskUserQuestion to let the user select which patterns to package. Allow multiple selection.

If the user invoked with a specific topic (`/distill <topic>`), skip scanning and proceed directly to Phase 2 with that topic.

## Phase 2: Refine

Interactive Q&A to shape each selected pattern into a complete specification.

### Question Sequence

Ask these using AskUserQuestion, adapting based on answers. Not all questions apply to every pattern — skip irrelevant ones.

**Q1: Package Type**
```
What format should this take?
- Skill (SKILL.md + references/scripts/assets) — for workflows with tools
- Specialist (agent .md) — for domain expertise that Claude should embody
- SOP document (standalone reference) — for procedures others follow
- Let me decide — describe the pattern and I'll recommend
```

**Q2: Core Description**
```
Describe the pattern in your own words. What problem does it solve?
What's the trigger — when should someone reach for this?
```

**Q3: Audience**
```
Who is this for?
- Just me (personal workflow)
- My team (shared across collaborators)
- Public (distributable to anyone)
```

**Q4: Scope & Boundaries**
```
What should this pattern handle? What should it NOT handle?
Are there edge cases or gotchas worth documenting?
```

**Q5: Dependencies**
```
Does this pattern depend on specific tools, APIs, files, or configurations?
(e.g., specific CLI tools, API keys, project structure, other skills)
```

**Q6: Reference Material**
```
Should any of the following be included as reference docs?
- SOPs or step-by-step procedures
- API documentation or schemas
- Configuration examples
- Decision trees or flowcharts
- Best practices / anti-patterns
```

**Q7: Scripts or Assets**
```
Does this pattern involve executable scripts or template files?
- Python/bash scripts that automate steps
- Template files (markdown, config, etc.)
- Sample data or fixtures
- None — it's purely instructional
```

**Q8: Output Location**
```
Where should this package be created?
- ~/.claude/skills/<name>/          (global, available everywhere)
- ~/.claude/agents/<name>.md        (global specialist)
- .claude/skills/<name>/            (project-local skill)
- .claude/agents/<name>.md          (project-local specialist)
- Custom path
```

### Adaptive Follow-ups

Based on answers, ask targeted follow-ups:

- If **Skill**: Ask about trigger phrases, slash command name
- If **Specialist**: Ask about model (haiku/sonnet/opus), color, expertise boundaries
- If **SOP**: Ask about format (checklist vs. narrative), update cadence

## Phase 3: Package

Build the deliverable based on the refined specification.

### Pre-build Checklist

Before writing files, confirm with the user:

```
Ready to package:

Name: [package-name]
Type: [skill | specialist | SOP]
Location: [output path]
Contents:
  - [file 1] — [purpose]
  - [file 2] — [purpose]
  ...

Proceed? [Y/n]
```

### Build by Type

#### Skills

1. Create directory at output location
2. Write SKILL.md with:
   - YAML frontmatter (name, description with trigger phrases)
   - Lean body that references supporting docs
3. Create `references/` with detailed docs (SOPs, guides, decision trees)
4. Create `scripts/` with any executable automation
5. Create `assets/` with any template files
6. Clean up — delete empty directories

Use templates from [TEMPLATES.md](TEMPLATES.md).

#### Specialists

1. Write single `.md` file to agents directory
2. Include YAML frontmatter (name, description, model, color)
3. Write role definition, capabilities, workflow, output format
4. Add trigger entry to appropriate CLAUDE.md

Use specialist template from [TEMPLATES.md](TEMPLATES.md).

#### SOPs

1. Write markdown document to references location
2. Structure as: Purpose > Prerequisites > Steps > Verification > Troubleshooting
3. Include practical examples at each step
4. Link from relevant SKILL.md or CLAUDE.md

Use SOP template from [TEMPLATES.md](TEMPLATES.md).

### Registration

After creating files:

**For Skills:**
- Skill is auto-detected from `~/.claude/skills/` or `.claude/skills/`
- No manual registration needed

**For Specialists:**
- Add trigger entry to the appropriate CLAUDE.md `Agent Usage` table
- Confirm which CLAUDE.md (global `~/.claude/CLAUDE.md` or project `.claude/CLAUDE.md`)

**For SOPs:**
- Link from relevant skill or CLAUDE.md section
- Ensure discoverability

## Phase 4: Verify

Validate the package works correctly.

### Verification Steps

1. **Structure check**: Confirm all files exist at expected paths
2. **Content check**: Read back key files and confirm with user
3. **Trigger test** (skills/specialists): Explain how to test the trigger phrase
4. **Registration check**: Confirm CLAUDE.md entries if applicable

### Summary Output

```
Distilled: [package-name]

Type: [skill | specialist | SOP]
Location: [path]
Files created:
  - [file] — [purpose]
  - [file] — [purpose]

Trigger: "[trigger phrase]" or /[command]
Registration: [auto-detected | added to CLAUDE.md]

To test: [specific instruction]
```

## Multi-Pattern Sessions

When multiple patterns are selected in Phase 1:

1. Run Phase 2 (Refine) for each pattern sequentially
2. Check for relationships — patterns that should reference each other
3. Run Phase 3 (Package) for all patterns
4. Cross-link related packages in their reference docs
5. Run Phase 4 (Verify) as a batch

## Edge Cases

### Pattern is too small for a skill
Recommend capturing as a memory entry or SOP reference instead of a full skill.

### Pattern spans multiple existing skills
Recommend an SOP that references existing skills, or a "meta-skill" that orchestrates them.

### Pattern is project-specific vs. universal
Ask the user. Default to project-local for specific patterns, global for universal ones.

### User wants to update an existing skill
Read the existing skill first, then present a diff of proposed changes for approval.
