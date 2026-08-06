---
name: folder-cleanup
description: Audit and consolidate a messy folder structure — identify duplicates, naming drift, stray files, and git repos — then generate a safe idempotent PowerShell cleanup script and housekeeping docs. USE WHEN user says "clean up this folder", "folder cleanup", "audit this directory", "messy folder structure", "consolidate folders", "folder drift", "workspace cleanup", "organize dev folder", or points at a directory and says it looks wrong.
---

# Folder Cleanup

End-to-end workflow for auditing a folder, planning a safe consolidation, generating an
idempotent PowerShell cleanup script via Gemini, and leaving housekeeping docs behind.

## References

- [WORKFLOW.md](references/WORKFLOW.md) - Full 4-phase SOP: Audit > Plan > Script > Execute
- [AI-ROUTING.md](references/AI-ROUTING.md) - Claude plans, Gemini generates the script, human approves

## Assets

- [folder-rules-template.md](assets/folder-rules-template.md) - Housekeeping doc template for any root folder
- [cleanup-script-template.ps1](assets/cleanup-script-template.ps1) - PowerShell cleanup script scaffold
