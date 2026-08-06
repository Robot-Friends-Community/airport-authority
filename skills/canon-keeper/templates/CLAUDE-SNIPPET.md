## Canon Keeper: {{KEEPER_NAME}}

**Tome:** `TOME.md` — the keeper's persistent log. Read this at session start for project context.
**Canon source:** `{{CANON_SOURCE}}` — single source of truth. All content defers to this document.
**Agent:** `{{KEEPER_NAME_LOWERCASE}}` — invoke with "canon check", "lore audit", or "sync check"

After any feature work, the keeper should verify:
- [ ] Canon source is updated if lore/products/characters changed
- [ ] All referenced docs are in sync
- [ ] Tome is updated with session notes
- [ ] Intranet sync status is current (if applicable)
