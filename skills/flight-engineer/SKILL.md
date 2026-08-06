---
name: flight-engineer
description: The vibe-coder's engineering guardian — a plain-language project-health sweep that keeps a project "airworthy" so small issues don't compound into getting bitten. Diagnoses git state, backups/PRs/CI, secrets, docs, dependencies, build, deploy drift, debt, and port/resource hygiene (via DoPA); reports with severity in non-engineer terms; executes safe forward-only fixes for you (you don't run commands); and gates merges + deploys on your explicit approval. USE WHEN the user says "flight-engineer", "/flight-engineer", "/mechanic", "check my project health", "is my project clean / airworthy", "hygiene sweep", "am I about to get bitten", "what's the state of this project", "pre-flight engineering check", "am I backed up", "port hygiene", "am I hogging ports", or before a takeoff/preflight on a real build. Also the single hygiene engine that /takeoff's git step and /preflight delegate to.
---

# Flight Engineer

The flight engineer keeps the aircraft airworthy — watching the systems the pilot shouldn't have to think about. This skill is that seat for a **non-engineer builder**: it sweeps a project for the things that quietly compound into "getting bitten" (work not backed up, secrets about to leak, prod drifting behind main), reports them in plain language, and **does the fixing for you** — because the whole point is you don't have to learn git mechanics.

## Operating model (the contract — read first)

This skill exists for people who **don't read code and don't run commands**. So:

- **Claude executes the mechanics.** Committing, pushing, opening PRs, adding a `CLAUDE.md` — you don't type these; Flight Engineer runs them after a one-line confirm. The confirm *is* your approval.
- **Two gates stay human: MERGE and DEPLOY.** These are irreversible and outward-facing (they change `main` or ship to the world). Flight Engineer surfaces them in plain language and runs them **only on your explicit yes** — but even then, *Claude* runs the command; you just approve.
- **Destructive operations are never auto-run in v1.** Force-push, history rewrite, hard reset, deleting branches/files, major dependency bumps — these are surfaced as flagged suggestions with the exact command, for a deliberate human/engineer decision. Flight Engineer will not fire them.
- **Every finding teaches the "why" in one line** (commit = checkpoint; push = backup; PR = reviewable proposal; merge = accept into main; deploy = ship live).

> Why not "report-only"? A pure read-only report would strand a non-engineer — someone still has to run the fix, and that someone is Claude. Why not "auto-everything"? Merges and deploys are the two moves you can't cleanly undo. This contract splits the difference: automate the safe mechanics, gate the irreversible ones.

## Severity language

Report every finding with a plain-language severity — no jargon:

- 🔴 **Will bite you** — act now (unpushed work, a secret about to be committed, failing CI on a PR you're about to merge).
- 🟡 **Should fix soon** — not urgent, but rot (missing `CLAUDE.md`, stale branches, outdated deps).
- 🟢 **Healthy** — confirm it's good so the user sees what's *right*, not just what's wrong.

## The sweep

Run each dimension in order. For each: **detect → report with severity → act per the contract.** Skip a dimension cleanly (note it, don't error) when its tool or context is absent — see *Graceful degradation*.

### 1. Git state — is your work safe?
- `git status --porcelain` — uncommitted changes? → offer to **commit to a feature branch** (never straight to `main`).
- On `main` or a feature branch? On `main` for real work → 🟡 explain and offer to branch.
- `git fetch` then compare — **unpushed commits** → 🔴 "N commits aren't backed up to GitHub yet" → offer to **push**.
- **Behind remote** → offer `git pull --rebase` (flag if it would conflict — don't force).
- Stale branches (merged or long-idle) → 🟡 list as cleanup suggestions (deletion is a human decision, not auto).

### 2. Backups, PRs & the merge gate
- `gh pr list` — open PRs for this repo.
- `gh pr checks <n>` — CI/checks status per PR. Failing → 🔴 explain which check and what it means.
- **The merge gate:** when a PR is green, surface it plainly — *"PR #N is ready and checks pass — it needs your approve-and-merge."* On your explicit **yes**, Claude runs the merge. Never auto-merge.
- **Mergeability reads `UNKNOWN`?** GitHub computes it asynchronously, so the first `gh pr view` right after opening/fetching often returns `UNKNOWN`. Re-poll once (`gh pr view <n> --json mergeable` again after a beat) before reporting. Never surface a raw "unknown" to the user — it reads as alarming when the PR is almost always fine.
- Offer `codex review` on a branch before merge as the non-Anthropic pre-approval review step (if `codex` is available).

### 3. Secrets — the hard stop
- Quick scan of uncommitted **and** tracked files for `.env`, private keys, `*_token`, `password =`, high-entropy strings.
- **If a secret is staged or about to be committed → 🔴 HARD STOP.** Do not commit. Tell the user exactly which file, and that secrets belong in `.env` (gitignored) or a secrets manager.
- Delegate a deeper pass to `secure-credential-audit` / `repo-safety-scanner` if available.

### 4. Project docs
- `CLAUDE.md` present? Missing on a real project → 🟡 offer to set one up (delegate to `claude-md-audit`).
- `README.md` present? Missing → 🟡 offer a starter.

### 5. Dependency health (report-only in v1)
- If a manifest exists (`package.json`, `requirements.txt`, etc.): run the ecosystem's audit (`npm audit`, etc.).
- Outdated/vulnerable → report with severity. **Updates are gated** — surface the command, don't auto-bump (a major bump can break the build; that's a deliberate decision).

### 6. Build / tests (report-only in v1)
- If a build/test command is known (from `package.json` scripts, a Makefile, project convention): run it.
- Broken build or failing tests → 🔴 report plainly. Don't attempt a fix in v1 — surface it.

### 7. Deploy drift (report-only; deploy is a human gate)
- If a deploy target is known (Vercel/Netlify/etc.): is **prod behind `main`**? → 🟡 "your live site is N commits behind your latest work."
- **Deploying is a human gate** — surface it, run it only on explicit approval.

### 8. Debt
- `TODO`/`FIXME` count, large uncommitted pileups, oversized files not meant for git.
- Report as 🟡/🟢 — informational, offer folder hygiene via `folder-cleanup` if drift is real.
- **Triage before crying wolf:** many `TODO` hits are template placeholders or docs *about* todos, not real debt. Sample them; report the count honestly and down-rate content-noise.

### 9. Port & resource hygiene (via DoPA — optional)
Matters most when several Claude/dev sessions run at once: two servers grabbing the same port means one session silently kills another's. If `dopa` is on PATH:
- `dopa patrol --json` — what's actually listening (PID + service label). Report the live servers plainly. **Attribute before flagging:** a listener with no `project` tie to the current repo — a system service (sshd, svchost), another project's server, or a shared daemon — is *context, not a problem*. Label it ℹ️ and move on. Only escalate ports that belong to **this** project (matching `project` in the registry) or are an unmistakable dev server for the current build.
- 🟡 **This project's dev server on a collision-prone port** (3000, 4000, 5000, 5173, 8000, 8080, 8888) → *"another session could kill this."* Suggest a safe reserved port from the `40400–40499` band via `dopa claim -q --project <name>`. (A collision-prone port owned by an *unrelated* service is ℹ️ informational, not 🟡 — don't cry wolf.)
- 🟡 **Unprotected long-lived service** (a DB, another session's server) → offer `dopa seal <port>` so it can't be accidentally killed.
- 🔴 **Orphaned / duplicate listeners** hogging ports → offer a **guarded** `dopa evict <port>` (refuses sealed/reserved/system ports) — **never** a blanket `taskkill node.exe` (that takes down every session; hard rule).
- Port eviction is a process kill, so it's **offer-on-confirm**, never automatic — and only ever through `dopa evict`'s guardrails.

## Graceful degradation (never blow up on a teammate's machine)

Every external tool is optional. If it's absent, **note the skip and move on** — never error out:
- Not a git repo → skip dimensions 1-2, say so.
- `gh` not installed / not authed → skip PR/CI checks, note "couldn't check PRs (gh not available)".
- No manifest / no build script / no deploy target → skip 5-7 cleanly.
- `dopa` not installed → skip dimension 9, note "port check skipped (DoPA not installed)". Never fall back to blanket process-killing.
- Optional helper skills absent (`claude-md-audit`, `folder-cleanup`, `secure-credential-audit`, `repo-safety-scanner`, `codex`) → do the built-in check inline and note the deeper pass was skipped.

A missing tool is a skipped check, never a crash.

## Output format

Lead with a one-line airworthiness verdict, then the findings grouped by severity, then the gated actions. Match the flight-deck house style (left-anchored, emoji section markers, no right border).

```
🔧 ═══════════ FLIGHT ENGINEER — <project> ═══════════

  Airworthiness:  🟡 mostly clean — 1 thing will bite you

  🔴 Will bite you
     • 3 commits not backed up to GitHub   (push = your off-machine backup)
  🟡 Should fix soon
     • CLAUDE.md missing                    (helps every future session)
     • prod is 5 commits behind main        (your live site is stale)
     • dev server on port 3000              (another session could kill it)
  🟢 Healthy
     • no secrets found · build passes · on a feature branch

  ─────────────────────────────────────────────
  I can do these now (just approve):
     ↳ Push the 3 commits?               [Y/n]
     ↳ Set up CLAUDE.md?                 [Y/n]
     ↳ Move the server to a safe port?   [Y/n]   (dopa claim, 40400–40499)
  Needs your approval (I'll run it on yes):
     🚦 Deploy latest to prod?           [y/N]
═══════════════════════════════════════════════════
```

## Single source of truth for hygiene

Flight Engineer is the **one** hygiene engine. Other flows delegate here instead of reimplementing:
- **`/takeoff`'s Git & GitHub hygiene step** → calls Flight Engineer for the git/secrets/PR sweep at session close.
- **`/preflight`'s hygiene step** → calls Flight Engineer for the project-health pass.

It orchestrates existing skills (`claude-md-audit`, `folder-cleanup`, `secure-credential-audit`, `repo-safety-scanner`, `codex review`) behind one plain-language front — all optional, all degrade gracefully.

## Safety rules (non-negotiable)

1. **Never commit secrets** — hard stop, always.
2. **Never commit straight to `main`** — branch first for any change.
3. **Merges and deploys require explicit human approval** — Claude runs them, but only on a clear yes.
4. **Never auto-run destructive git** in v1 — no force-push, history rewrite, hard reset, or branch/file deletion. Surface them as suggestions with the exact command.
5. **Fetch before judging "behind"/"ahead"** — never force-push a shared branch.

## Not in v1 (deferred to v2)

Auto-applying dependency updates, auto-fixing a broken build, destructive cleanup/repair, and multi-repo orchestration. v1 reports these and hands over the exact command; it does not execute them.
