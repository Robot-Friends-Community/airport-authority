# Folder Cleanup Workflow

End-to-end SOP for auditing and consolidating a messy folder structure safely.

## When to Use

- A root folder has accumulated naming drift (e.g. `Data/` and `_DATA/`)
- Duplicate folders exist for the same purpose
- Stray files, empty folders, or Windows artifacts are at the root
- You want to establish conventions and housekeeping docs for a workspace

## Prerequisites

- Know the target root folder path
- Have PowerShell available
- Have Codex CLI available (`codex`) for script generation

---

## Phase 1: Audit

**Goal:** Full inventory before touching anything.

### 1.1 List root contents with dates

```bash
ls -la /path/to/folder/
```

### 1.2 Spot the pattern categories

Look for:
| Signal | Example |
|--------|---------|
| Naming drift | `Data/` vs `_DATA/`, `Tools/` vs `_TOOLS/` |
| Duplicate purpose | Two folders that do the same job |
| Stray root items | Zero-byte files, `.lnk` shortcuts, bare repos |
| Ghost wrappers | Folder that only contains one subfolder |
| Nested surprises | A folder cloned inside itself |

### 1.3 Check for git repos BEFORE planning any moves

```bash
ls -la /path/to/suspect-folder/
# Look for .git/ — if present, check remote before moving
cd /path/to/suspect-folder && git remote -v && git status
```

**Critical:** A folder with `.git/` is a live repo. Moving it breaks the working tree.
Check for:
- Uncommitted changes (commit first)
- Pending pushes
- Whether it belongs in its current location

### 1.4 Check for path dependencies

Before moving any folder with executables or compiled binaries, ask:
- Does anything on PATH or in config files reference this location by name?
- Is this a tool installed with a hardcoded path (Flutter, QMK, etc.)?
- If unsure — leave it in place, document it in DEV-RULES.md

### 1.5 Check contents of apparent duplicates

```bash
ls /path/folder-a/ && ls /path/folder-b/
```

Determine:
- Identical? → one is safe to remove after merging
- Overlapping? → need file-level comparison
- Complementary? → different purposes, not duplicates (check before merging)

---

## Phase 2: Plan

**Goal:** Written plan reviewed before any script runs.

### 2.1 Write plan to a file

Write `cleanup-plan.md` in the target folder with:
- List of moves (source → destination)
- List of deletions (with empty-check requirement)
- List of housekeeping docs to create
- Explicit list of folders NOT to touch and why

Use the structure:
```
## Phase 2: FILE MOVES
Move-Item: [src] -> [dest]
NOTE: [any conflict/dependency warning]

## Phase 3: DELETE (empty only)
[folder] — verify empty after moves

## Phase 4: CREATE HOUSEKEEPING DOCS
[path] — [what it documents]

## DO NOT TOUCH
[folder] — [reason: git repo / path deps / etc.]
```

### 2.2 Bulletproof the plan

Before handing to Gemini, review:
- [ ] Every source path verified to exist
- [ ] Every destination parent exists or will be created
- [ ] No moves that would break git repos
- [ ] No deletes without empty-check guard
- [ ] Leaf dirs removed before parent dirs (deletion order)
- [ ] Data conflict paths flagged with SKIP + WARNING (not silent overwrite)

---

## Phase 3: Generate Script via Codex

**Goal:** Codex writes the PowerShell — saves Claude tokens, keeps Claude in planning/reasoning role.

See [AI-ROUTING.md](AI-ROUTING.md) for the full routing rationale.

```bash
cd C:\Target\Folder
codex exec --skip-git-repo-check "Read ./cleanup-plan.md and generate a PowerShell cleanup script described in the DELIVERABLE section. Output only the script." > cleanup-output.txt
```

### Review the generated script for:

1. **Em dash corruption** — generators sometimes emit `—` which breaks PowerShell string parsing.
   Fix: replace all `—` with `-` in Write-Host strings (not in comments or here-strings).

2. **Deletion order** — Must remove leaf directories before parents.
   Wrong: `Remove-Item _PROJECTS_/` (fails if `_PROJECTS_/_OLD-GROUP/old_project/` still exists)
   Right: Remove `old_project/` → `_OLD-GROUP/` → `_PROJECTS_/`

3. **Empty-check guard** — Deletions must use `Get-ChildItem -Force` count check, not blind `Remove-Item -Recurse`.

4. **Scope prefix on counters** — Inside functions, use `$script:summary.MOVED++` not `$summary.MOVED++`.

5. **Idempotency** — Every action must start with `if (Test-Path ...)`.

---

## Phase 4: Execute

**Goal:** Run the script, handle warnings, clean up artifacts.

### 4.1 Run and capture output

```powershell
cd C:\Target\Folder
.\run-cleanup.ps1
```

### 4.2 Interpret warnings

| Warning type | Meaning | Action |
|-------------|---------|--------|
| "Destination already has content" | Data conflict on merge | Compare contents manually, then move what's unique |
| "Not empty, skipping" | Folder has hidden files (`.gitkeep`) | Check — may be intentional scaffolding, leave it |
| "Source not found" | Already cleaned up or path typo | Verify, move on |

### 4.3 Handle data conflicts manually

```bash
ls /path/conflicted-source/
ls /path/conflicted-dest/
# Determine if contents overlap or are complementary
# Move unique files manually, then delete the empty source
```

### 4.4 Verify final state

```bash
ls -la /path/to/folder/
```

Confirm:
- [ ] All duplicate folders gone
- [ ] All stray files gone
- [ ] Housekeeping docs present in each root folder
- [ ] Git repos still in place and healthy

### 4.5 Clean up working files

Delete after confirmed success:
- `cleanup-plan.md`
- `run-cleanup.ps1`

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `else is not recognized` | Em dash in Write-Host string corrupting parser | Find and replace `—` with `-` in all Write-Host strings |
| `Not empty, skipping` on expected-empty dir | `.gitkeep` or hidden file present | `ls -la` the dir — if just `.gitkeep`, it's intentional scaffolding |
| Move fails silently | Destination path parent doesn't exist | Add `New-Item -ItemType Directory` guard before Move-Item |
| Git repo breaks after move | Moved a `.git` folder | Restore to original location; git repos must be committed to before moving |

## Best Practices

- Always audit before planning, plan before scripting, script before executing
- Never move a folder that contains `.git/` without first checking git status
- Prefer explicit path moves over glob patterns — precision over convenience
- Leave `DEV-RULES.md` (or equivalent) in every root folder you clean
- The script is the paper trail — keep it until you've verified the result
