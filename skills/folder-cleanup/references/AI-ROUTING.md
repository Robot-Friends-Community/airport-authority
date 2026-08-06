# AI Routing: Claude Plans, Codex Executes

## The Pattern

For folder cleanup tasks, split the work across models by role:

| Role | Model | Why |
|------|-------|-----|
| Audit + planning | Claude | Needs reasoning about git repos, path deps, naming conventions, conflict detection |
| Script generation | Codex CLI | Producing boilerplate PowerShell from a structured plan is exactly the bulk-generation job to offload |
| Review + approval | Human | Eyes on before anything destructive runs |
| Execution | PowerShell | The generated script |

Claude costs ~$15-75/M tokens. Generating a 300-line PowerShell script from a spec is exactly the kind of boilerplate to offload. (Gemini CLI was the former offload target but was retired — all such routes now go to Codex.)

## How to Hand Off to Codex

### 1. Write the plan to a file

```bash
# Plan file should be in the target folder or a temp location
C:\Target\Folder\cleanup-plan.md
```

### 2. Call Codex with file context

Codex reads files from its working directory, so `cd` to the folder holding the plan and reference it by relative path:

```bash
cd C:\Target\Folder
codex exec --skip-git-repo-check "Read ./cleanup-plan.md and generate the PowerShell cleanup script described in the DELIVERABLE section. Output only the complete script, no explanation." > cleanup-output.txt
```

### 3. Read and review the output

```bash
cat cleanup-output.txt
```

Copy the script content to `run-cleanup.ps1` in the target folder.

### 4. Review the generated PowerShell before running

Any model-generated PowerShell should be checked for these common issues before it runs — reorder/patch as needed:

**Issue 1: Em dash corruption in Write-Host strings**
Generators often emit `—` (em dash, U+2014) in comments and strings. In PowerShell this corrupts
string parsing when inside double-quoted strings passed to Write-Host.

Grep for it:
```bash
grep -n "—" run-cleanup.ps1
```

Fix: replace `—` with `-` in any `Write-Host "..."` line.
Safe to leave in: comments (`#`), here-strings (`@"..."@`), markdown content.

**Issue 2: Deletion order (leaf before parent)**
Generated scripts sometimes try to delete a parent folder directly without removing
empty children first. The empty-check guard catches this, but you get
spurious "not empty" warnings.

Fix: manually reorder deletions to go deepest-first:
```
# Wrong order:
Safe-Remove-Dir "$root\_PROJECTS_"          # fails — has children

# Right order:
Safe-Remove-Dir "$root\_PROJECTS_\_OLD-GROUP\old_project"  # leaf
Safe-Remove-Dir "$root\_PROJECTS_\_OLD-GROUP"              # then parent
Safe-Remove-Dir "$root\_PROJECTS_"                          # then grandparent
```

**Issue 3: $script: scope on counter increments**
Inside functions, PowerShell requires explicit scope for external variables:
```powershell
# Wrong (frequently generated):
$summary.MOVED++

# Right:
$script:summary.MOVED++
```

### 5. Run the reviewed script

```powershell
cd C:\Target\Folder
.\run-cleanup.ps1
```

## When NOT to Offload Script Generation

- If the plan has complex conditional logic (keep it in Claude instead)
- If Codex CLI isn't available in the current environment
- If the cleanup is tiny (3-4 moves) — just run the moves manually
