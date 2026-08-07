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

> **Flight Ops (v1.1): enqueue as you detect.** As of Airport Authority v1.1, three of the dimensions below double as **alert producers** — failing CI (dim 2), uncommitted pileup (dim 8), and durable-memory drift (dim 10). When you find one, besides reporting it inline you **enqueue it to the durable alert queue** so it survives this session and reaches `#rf-alerts`. Then, at the end of the sweep, you **flush** the queue to Slack. Both use the alert CLI — see *Flight Ops: the alert queue* below. Enqueue is a local, network-free append; only the final flush touches Slack.

### 1. Git state — is your work safe?
- `git status --porcelain` — uncommitted changes? → offer to **commit to a feature branch** (never straight to `main`).
- On `main` or a feature branch? On `main` for real work → 🟡 explain and offer to branch.
- `git fetch` then compare — **unpushed commits** → 🔴 "N commits aren't backed up to GitHub yet" → offer to **push**.
- **Behind remote** → offer `git pull --rebase` (flag if it would conflict — don't force).
- **Diverged from remote** — local *and* upstream have each moved (the classic multi-session snarl): say it plainly — "your copy and GitHub have both moved on; they need reconciling" — and offer `git pull --rebase` (flag a likely conflict; never force-push to resolve).
- Stale branches (merged or long-idle) → 🟡 list as cleanup suggestions (deletion is a human decision, not auto).

**Repo integrity — is the repo in a weird half-state?** (read-only detection; the fixes below are surfaced, not auto-run)
- **Interrupted operation** — a half-finished merge / rebase / cherry-pick / revert (from `git status`, or `.git/MERGE_HEAD` · `.git/rebase-merge` · `.git/CHERRY_PICK_HEAD`): 🔴 "you're mid-`<operation>` — it has to be finished or called off before anything else is safe." Surface the exact `--continue` **and** `--abort` commands; **never** auto-abort (it discards in-progress work — a human call).
- **Unmerged / conflicted paths** (`git status` shows `UU`/`AA`/`DU`): 🔴 name the files — "these still have conflict markers to resolve."
- **Detached HEAD** (not on any branch): 🟡 "you're not on a branch — commits made here can be lost." Offer to branch from here (`git switch -c <name>`).
- **Forgotten stashes** (`git stash list`): 🟡 "you have N sets of changes stashed aside — easy to lose track of." List them; restoring or dropping is a human decision.
- **Active worktrees** (`git worktree list` shows more than one): ℹ️ list each and the branch it holds — this is how parallel sessions stay uncollided (context, not a problem). Escalate to 🟡 only if two worktrees sit on the **same** branch (they'll fight).

### 2. Backups, PRs & the merge gate
- `gh pr list` — open PRs for this repo.
- `gh pr checks <n>` — CI/checks status per PR. Failing → 🔴 explain which check and what it means.
  → **Enqueue** (Flight Ops): `enqueue --kind ci-failure --severity red --message "CI failing on PR #<n> (<check>)" --project <repo>`.
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
- **Uncommitted pileup** — a real, growing body of uncommitted work (not template noise) is work at risk. → **Enqueue** (Flight Ops): `enqueue --kind uncommitted-pileup --severity yellow --message "<N> uncommitted files piling up (work not backed up)" --project <repo>`. Threshold it (e.g. ≥8 changed files, or files older than a day) so a two-file work-in-progress doesn't nag.
- **Oversized or wrong-kind tracked files** — scan `git ls-files` for things that shouldn't be versioned: anything large (roughly >5 MB) or build/dependency output committed by accident (`node_modules/`, `dist/`, `build/`, `.venv/`, `*.log`). 🟡 "`<path>` is tracked but looks like a build artifact / large binary — it bloats every clone." Offer to **untrack it while keeping it on disk** (`git rm --cached <path>` + add to `.gitignore`); purging a big blob from *history* is a deliberate destructive step — surface `git filter-repo`, never auto-run it.
- **Line-ending churn** (cross-platform teams — e.g. Windows + macOS): if the repo has no `.gitattributes` and Git is emitting `LF will be replaced by CRLF` warnings, 🟡 note it — "files flip between Windows/Mac line endings, which muddies every diff." Offer a starter `.gitattributes` (`* text=auto`).

### 9. Port & resource hygiene (via DoPA — optional)
Matters most when several Claude/dev sessions run at once: two servers grabbing the same port means one session silently kills another's. If `dopa` is on PATH:
- `dopa patrol --json` — what's actually listening (PID + service label). Report the live servers plainly. **Attribute before flagging:** a listener with no `project` tie to the current repo — a system service (sshd, svchost), another project's server, or a shared daemon — is *context, not a problem*. Label it ℹ️ and move on. Only escalate ports that belong to **this** project (matching `project` in the registry) or are an unmistakable dev server for the current build.
- 🟡 **This project's dev server on a collision-prone port** (3000, 4000, 5000, 5173, 8000, 8080, 8888) → *"another session could kill this."* Suggest a safe reserved port from the `40400–40499` band via `dopa claim -q --project <name>`. (A collision-prone port owned by an *unrelated* service is ℹ️ informational, not 🟡 — don't cry wolf.)
- 🟡 **Unprotected long-lived service** (a DB, another session's server) → offer `dopa seal <port>` so it can't be accidentally killed.
- 🔴 **Orphaned / duplicate listeners** hogging ports → offer a **guarded** `dopa evict <port>` (refuses sealed/reserved/system ports) — **never** a blanket `taskkill node.exe` (that takes down every session; hard rule).
- Port eviction is a process kill, so it's **offer-on-confirm**, never automatic — and only ever through `dopa evict`'s guardrails.

### 10. Durable-memory drift (Tome / Bible)
Matters on **keeper** projects — ones carrying a `TOME.md` (canon-keeper) or `BIBLE*.md` / `.bible-keeper.json`. The failure mode: the repo moves (commits land, beads close) but the durable-memory front page freezes because a session closed without a `/takeoff`. Landing's RESUME.md §2.6 does this same probe.
- No `TOME.md` / Bible in the project → **skip cleanly** (most repos, including this one). Not a finding.
- If `TOME.md` exists: compare its **Current Session** front-page marker (session number / date) against the newest `FLIGHT-RECORDER.md` entry **and** repo reality (`git log -1`, recent `bd list --status=closed`). If commits/beads advanced past the Tome's front-page date → 🟡 **"Tome front page is stale — repo moved, durable memory didn't."**
  → **Enqueue** (Flight Ops): `enqueue --kind tome-drift --severity yellow --message "Tome front page stale — repo advanced past it; reconcile at next /canon-keeper takeoff" --project <repo>`.
- The fix is a **surfaced suggestion, not an auto-run**: recommend `/canon-keeper takeoff` (refreshes the front page + appends history), never `/canon-keeper log` (append-only, leaves the front page to rot). Reconciling canon is a human-reviewed step.

## Flight Ops: the alert queue (enqueue-on-detect + flush)

Airport Authority v1.1 gives the sweep a **durable memory**: findings that would otherwise vanish when the session ends are enqueued to a user-global alert queue and later posted to `#rf-alerts`. This closes the gap where a 🔴 found in a throwaway session was never seen again.

**Why a queue and not a direct post?** Hooks that also enqueue (durable-write failures) run headless with no Slack auth — a direct post would be lost. So *every* producer enqueues locally (network-free), and only two consumers drain it: `flight-status.js` surfaces unsent alerts at every SessionStart (guaranteed, offline-safe), and **this skill** flushes them to Slack. You are the Slack consumer.

**The CLI.** All queue operations go through `alert-cli.js` in the Airport Authority hooks lib (it ships both canonical and mirrored). **Use whichever shell tool is available in your environment** — the commands below are given in both POSIX and PowerShell, since this runs on Windows (PowerShell-primary) as well as macOS/Linux. Resolve the CLI path once at the start of the sweep, then reuse it:

```bash
# POSIX — prefer the installed plugin copy, fall back to the source repo.
ALERT_CLI="$(ls "$HOME"/.claude/plugins/*/airport-authority/hooks/lib/alert-cli.js \
                "$HOME"/.claude/plugins/airport-authority/hooks/lib/alert-cli.js \
                ./hooks/airport-authority/lib/alert-cli.js \
                ./plugins/airport-authority/hooks/lib/alert-cli.js 2>/dev/null | head -1)"
```
```powershell
# PowerShell — same precedence.
$AlertCli = @(
  "$env:USERPROFILE\.claude\plugins\*\airport-authority\hooks\lib\alert-cli.js",
  "$env:USERPROFILE\.claude\plugins\airport-authority\hooks\lib\alert-cli.js",
  ".\hooks\airport-authority\lib\alert-cli.js",
  ".\plugins\airport-authority\hooks\lib\alert-cli.js"
) | ForEach-Object { Get-ChildItem $_ -ErrorAction SilentlyContinue } | Select-Object -First 1 -ExpandProperty FullName
```
If none resolves, note "alert queue unavailable (Airport Authority hooks not found)" and continue — enqueue/flush degrade to no-ops, the rest of the sweep is unaffected.

**Enqueue as you detect** (dims 2, 8, 10 above) — coalescing is automatic (a repeat of the same condition bumps a count, it doesn't duplicate). `node "$ALERT_CLI" …` (POSIX) or `node $AlertCli …` (PowerShell):
```
node "$ALERT_CLI" enqueue --kind ci-failure --severity red --message "CI failing on PR #12 (build)" --project your-team-library
```
If a `--message` value could start with `--`, use the `--message="…"` form.

**Flush at the end of the sweep** (the last step, after all dimensions have reported and enqueued):
```
node "$ALERT_CLI" digest        # -> { channel, text, ids, tokens }
```
- If `text` is empty → nothing to flush; say "no unresolved Flight Ops alerts to post" and stop.
- Otherwise post `text` to `#rf-alerts` (`C0AV5A76HFC`) via mcpl, then mark the **`tokens`** the digest returned (not `ids`, not `--all`):
```
mcpl call --no-daemon router route_request '{"service":"slack","action":"post_message","params":{"channel_id":"C0AV5A76HFC","text":"<digest.text>"}}'
node "$ALERT_CLI" mark-sent <token1> <token2> ...
```
Each token is `id@lastTs` — mark-sent clears an alert only if its lastTs still matches, so a re-fire that coalesced during the flush is left unsent and re-posts next time (never silently dropped). If the Slack post fails (auth/network), **do not** mark-sent: the alerts stay queued and `flight-status.js` re-surfaces them next SessionStart. Report "couldn't reach #rf-alerts — alerts stay queued for next flush."

## Graceful degradation (never blow up on a teammate's machine)

Every external tool is optional. If it's absent, **note the skip and move on** — never error out:
- Not a git repo → skip dimensions 1-2, say so.
- `gh` not installed / not authed → skip PR/CI checks, note "couldn't check PRs (gh not available)".
- No manifest / no build script / no deploy target → skip 5-7 cleanly.
- `dopa` not installed → skip dimension 9, note "port check skipped (DoPA not installed)". Never fall back to blanket process-killing.
- No `TOME.md` / Bible → skip dimension 10 cleanly (not a finding).
- `alert-cli.js` not resolvable or mcpl/Slack unreachable → enqueue/flush degrade to no-ops; note "alert queue unavailable" or "alerts stay queued for next flush". Never let a failed flush block the sweep or drop an alert.
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

  📼 Flight Ops:  posted 2 alerts to #rf-alerts   (or: no unresolved alerts · or: couldn't reach Slack — stay queued)
═══════════════════════════════════════════════════
```

Run the alert flush as the **final** action, after the gated items — so a single #rf-alerts digest reflects the whole sweep (including anything you just fixed vs. anything still 🔴).

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
