---
name: bible-keeper
description: Log decisions and state changes to project department Bibles during long builds. Discovers existing Bibles, scaffolds new ones, routes entries by topic. USE WHEN user says "log to bible", "update bible", "bible entry", "record this decision", "bible-keeper", or when a significant decision is made during a build that should be preserved across sessions.
---

# Bible Keeper

Log decisions, state changes, and institutional knowledge to the right project Bible during long builds. Works in any project -- discovers existing Bibles, scaffolds new ones, stores config per-project.

## Commands

| Command | Description |
|---------|-------------|
| `/bible-keeper` | No args: batch scan conversation for unlogged decisions |
| `/bible-keeper "description"` | Direct: route a single entry to the right Bible |
| `/bible-keeper setup` | Run the scaffolding wizard (auto-runs on first use if no Bibles found) |
| `/bible-keeper status` | Show Bible inventory and last-updated dates |

---

## Step 1: Discover or Scaffold

On every invocation, first determine the Bible setup for the current project.

### Check for config

Look for `.bible-keeper.json` in the current working directory or git root.

**If config exists:** load it and proceed to Step 2.

```json
// Example .bible-keeper.json
{
  "bibles": [
    {
      "name": "Marketing",
      "path": "GTM-Sprint-Docs/BIBLE-MARKETING.md",
      "topics": ["channels", "content", "campaigns", "ICP", "verticals", "website", "SEO", "lead magnets", "analytics", "ads"]
    },
    {
      "name": "Sales",
      "path": "GTM-Sprint-Docs/BIBLE-SALES.md",
      "topics": ["pipeline", "pricing", "outreach", "CRM", "proposals", "close process", "reps", "commissions"]
    }
  ]
}
```

**If no config exists:** run discovery.

### Discovery

Search the project for existing Bible files:

```bash
# Check common patterns
find . -maxdepth 3 -iname '*bible*' -name '*.md' 2>/dev/null
find . -maxdepth 3 -iname '*BIBLE*' -name '*.md' 2>/dev/null
```

**If Bibles found:**
1. List them and ask the user to confirm which ones to track
2. For each confirmed Bible, read the file and auto-detect topics from its content (section headers, keywords)
3. Generate `.bible-keeper.json` with paths and detected topics
4. Confirm the config with the user

**If no Bibles found:**
1. Tell the user: "No Bibles found in this project. Want me to set them up?"
2. If yes, proceed to the Scaffolding Wizard
3. If no, exit

### Scaffolding Wizard

Interactive setup for a new project:

**Question 1:** "What areas does this project need to track decisions for?"

Offer common presets plus custom:

| Preset | Bibles Created |
|--------|---------------|
| **Agency / services business** | Marketing, Sales, Ops/Admin |
| **SaaS product** | Product, Engineering, Marketing, Ops |
| **Content / media** | Editorial, Production, Distribution |
| **Client project** | Delivery, Client Comms, Technical |
| **Custom** | User names their own categories |

**Question 2:** "Where should the Bible files live?" (default: project root, or suggest existing `docs/` folder if present)

**Then:**
1. Create each Bible file with starter structure (see Template below)
2. Write `.bible-keeper.json` with paths and topic routing
3. Confirm to user what was created

### Bible Template

Each scaffolded Bible follows this structure:

```markdown
# [Project Name] [Department] Bible

> Department north star. Canonical reference for [topic area].
> Owner: [leave blank] | Last updated: [today's date]
> Status: Active Operating Document

---

## Key Decisions

[Entries will be appended here by bible-keeper]

---

## Current State

[Manual section for the team to describe current state]

---

## Recent Updates

[Overflow section for entries that don't fit above]
```

Keep the template minimal. The user will flesh it out over time. The scaffolding just gives them structure to write into.

---

## Step 2: Route the Entry

### Direct Mode (`/bible-keeper "description"`)

1. Load `.bible-keeper.json` to get Bible names, paths, and topics
2. Match the entry description against each Bible's topic keywords
3. If clear match: proceed to Step 3
4. If ambiguous (matches multiple): ask the user which Bible
5. If no match: default to the first Bible's "Recent Updates" section, tell the user

### Batch Mode (`/bible-keeper` with no args)

1. Scan the current conversation for unlogged decisions. Look for:
   - Pricing, product, or packaging changes
   - Infrastructure deployed, moved, or retired
   - New tools adopted or old tools dropped
   - Pipeline or process changes
   - Content schedule modifications
   - Domain, DNS, or deployment changes
   - Team role or responsibility updates
   - Architecture decisions
   - Data model or schema changes
2. Present a numbered list of candidate entries with proposed Bible routing
3. User confirms, drops, or reroutes entries
4. Append confirmed entries

---

## Step 3: Write the Entry

1. **Read the target Bible** to find the correct section
2. Find the best-fit section by scanning `##` headers against the entry topic
3. Append the entry at the bottom of that section (before the next `---` or `##`)
4. If no section fits, append to `## Recent Updates` (create it if missing)
5. Update the `Last updated:` date in the Bible header
6. Confirm to the user: which Bible, which section, what was logged

### Entry Format

```
- **[YYYY-MM-DD]:** [Concise description. 1-3 lines. Include why, not just what.]
```

---

## Rules

1. **Read before write.** Always read the target Bible to find the right section. Never guess.
2. **Append only.** Never overwrite, reorder, or edit existing content.
3. **Don't create new sections** unless it's `## Recent Updates` as a fallback.
4. **Keep entries concise.** 1-3 lines. Useful in 6 months, scannable now.
5. **Date stamp everything.** `YYYY-MM-DD`.
6. **Update the header date** after appending.
7. **One entry per decision.** Multiple decisions = multiple entries (may route to different Bibles).
8. **Config is per-project.** `.bible-keeper.json` lives at the project root. Different projects have different Bibles.
9. **Don't duplicate canon-keeper.** Bible-keeper logs decisions. Canon-keeper audits consistency. They don't overlap.
