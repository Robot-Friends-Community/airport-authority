# Distill Templates

Output templates for each package type. Use these as starting structures — adapt to fit the pattern being packaged.

## Skill Template

### SKILL.md

```markdown
---
name: {skill-name}
description: {What it does}. USE WHEN user says "{trigger1}", "{trigger2}", "{trigger3}", or {broader trigger description}.
---

# {Skill Title}

{1-2 sentence overview of what this skill enables.}

## References

- [{reference-name}](references/{filename}.md) - {what it covers}
```

### Reference Doc (SOP-style)

```markdown
# {Title}

{Brief context — why this process exists, what problem it solves.}

## Prerequisites

- {Dependency 1}
- {Dependency 2}

## Workflow

### Step 1: {Action}

{What to do, with concrete examples.}

### Step 2: {Action}

{What to do, with concrete examples.}

### Step 3: {Action}

{What to do, with concrete examples.}

## Verification

How to confirm the workflow succeeded:
- {Check 1}
- {Check 2}

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| {Problem} | {Why} | {Solution} |

## Best Practices

- {Practice 1}
- {Practice 2}
```

### Reference Doc (Decision-tree style)

```markdown
# {Title}

## Decision Tree

```
{Condition A}?
├── Yes → {Action 1}
│   └── {Sub-condition}?
│       ├── Yes → {Action 1a}
│       └── No → {Action 1b}
└── No → {Action 2}
```

## Detailed Guidance

### When {Condition A}

{Explanation and examples.}

### When NOT {Condition A}

{Explanation and examples.}
```

## Specialist Template

```markdown
---
name: {specialist-name}
description: {Domain expertise description}. USE WHEN user says "{trigger1}", "{trigger2}", "{trigger3}", or needs {specific help}.
model: {haiku|sonnet|opus}
color: {red|green|blue|purple|yellow|orange}
---

You are a {Role Name} with expertise in {domain}. Your role is to {primary function}.

## Your Expert Capabilities

- {Capability 1}
- {Capability 2}
- {Capability 3}

## Core Responsibilities

### 1. {Responsibility Area}
- {Detail 1}
- {Detail 2}

### 2. {Responsibility Area}
- {Detail 1}
- {Detail 2}

## Operational Workflow

When given a task:

1. **Understand**: {How to interpret requests}
2. **Analyze**: {How to break down the problem}
3. **Execute**: {How to deliver results}
4. **Validate**: {How to ensure quality}

## Boundaries

What you handle:
- {In-scope 1}
- {In-scope 2}

What you do NOT handle:
- {Out-of-scope 1} — recommend {alternative}
- {Out-of-scope 2} — recommend {alternative}

## Output Format

{Define expected deliverable structure with example.}
```

## SOP Template

```markdown
# {SOP Title}

**Purpose:** {Why this procedure exists}
**Owner:** {Who maintains this}
**Last updated:** {Date}

## When to Use

Use this procedure when:
- {Trigger condition 1}
- {Trigger condition 2}

Do NOT use this when:
- {Exclusion 1} — use {alternative} instead

## Prerequisites

- [ ] {Requirement 1}
- [ ] {Requirement 2}

## Procedure

### Step 1: {Action verb} {object}

{Detailed instructions.}

**Example:**
```
{Concrete example of this step}
```

**Checkpoint:** {How to verify this step succeeded}

### Step 2: {Action verb} {object}

{Detailed instructions.}

**Example:**
```
{Concrete example of this step}
```

**Checkpoint:** {How to verify this step succeeded}

### Step 3: {Action verb} {object}

{Detailed instructions.}

## Verification

After completing all steps:
- [ ] {Final check 1}
- [ ] {Final check 2}

## Rollback

If something goes wrong:
1. {Recovery step 1}
2. {Recovery step 2}

## Troubleshooting

| Symptom | Likely Cause | Resolution |
|---------|-------------|------------|
| {What you see} | {Why} | {What to do} |

## Changelog

| Date | Change | Author |
|------|--------|--------|
| {Date} | Initial version | {Name} |
```

## Naming Conventions

| Type | Format | Example |
|------|--------|---------|
| Skill directory | `kebab-case` | `outreach-researcher` |
| Specialist file | `kebab-case.md` | `legal-review-specialist.md` |
| SOP file | `UPPER-KEBAB.md` or `kebab-case.md` | `DEPLOY-PROCEDURE.md` |
| Reference docs | `UPPER.md` or descriptive `kebab-case.md` | `WIZARD.md`, `api-reference.md` |

## Quality Checklist

Before finalizing any package:

- [ ] Name is clear and descriptive
- [ ] Description includes USE WHEN triggers
- [ ] All referenced files exist
- [ ] No placeholder/TODO content remains
- [ ] Examples are concrete, not abstract
- [ ] Boundaries defined (what it does AND does not do)
- [ ] Dependencies documented
- [ ] Tested with trigger phrase (skills/specialists)
