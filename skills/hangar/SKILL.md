---
name: hangar
description: Full project ignition the opinionated way — scaffold a new project across its two homes (an S: planning/research hub + a C: code home linked by a private GitHub repo) AND wire up every durable-memory surface using the REAL skills: flight-deck Flight Recorder (multi-user), bible-keeper Bible, canon-keeper Tome (for ecosystems), beads task OS (shared-safe), and — for client projects — a named client Chief-of-Staff agent via client-assistant. USE WHEN the user says "new project", "scaffold this project", "set up a new project", "start a project", "spin up a project properly", "hangar", "set up the folders + repo", "start a client project", or a project moves from ad-hoc exploration into a real, tracked build. NOT for scaffolding code frameworks (use nextjs-init), single GitHub repos in isolation (use a repo-standard skill), or AI-workflow folders (use workspace-architect).
---

# Hangar — Project Ignition

Where a project gets built and prepped before it ever flies. Hangar turns an exploration into a real, tracked build: the two-home folder structure, the repo, and every durable-memory surface the aviation-family skills expect (`flight-deck` / `takeoff` / `landing` / `preflight` all assume these exist — hangar is what installs them).

**Design principle — delegate, don't hand-author.** Each durable surface has ONE owning skill and ONE source of truth. Hangar does not write its own recorder/bible/tome markdown; it *invokes* the real skills so the files are the genuine, tool-maintained artifacts. That way `/takeoff`, `/bible-keeper`, and `/canon-keeper` keep working against them forever.

## The pattern (and why)

| Home | Path convention | Holds |
|------|-----------------|-------|
| **Hub** | `S:\<company>\<project>` (shared drive) | Planning, research, strategy, creative, docs, **all durable-memory surfaces** (recorder/bible/tome). The coordination home the whole team can reach. |
| **Code** | `~/projects/_<COMPANY>/<project>` (local) | Active build — node_modules, file watchers, git. Local because mounted drives are slow for build tooling. |
| **Remote** | `github.com/<org>/<project>` (private) | Git remote for the code home. |

Docs + durable memory on S:, code on C:, linked by `git push`. This mirrors the global CLAUDE.md file-organization policy — don't fight it. Durable-memory surfaces live in the **hub** because that's the shared, team-reachable home — and flight-deck's multi-user mode is built for exactly this shared-drive case.

## Before scaffolding — recon (never guess)

Run these and read the results before creating anything:

```bash
gh auth status && gh api user/orgs --jq '.[].login'   # which orgs exist
ls "~/projects"                                        # confirm the _<COMPANY> parent
```

Then resolve the decisions you cannot infer. Ask the user (one batched question) only for genuinely ambiguous, hard-to-reverse choices:
- **GitHub org** — if several plausible orgs exist, ask; don't guess.
- **Repo name + visibility** — default to matching the folder name and **private**; state the default and proceed unless they object.
- **Is this a client project?** — determines whether a client CoS agent gets scaffolded (Step 5). Infer from the company / whether the hub sits under a client parent (e.g. `S:\client-projects\`); confirm if unsure.
- **Is this an ecosystem?** (multiple repos/sites/lore that must stay consistent) — determines whether a Tome gets scaffolded (Step 2c).
- Everything else (paths, doc set) follows the pattern — just do it.

## Step 1 — Scaffold the hub (S:)

Create the structure and move any existing exploration artifacts into it:

```
<project>/
├── README.md              # overview + index
├── CLAUDE.md              # working instructions — read-first
├── docs/
│   ├── strategy/          # briefs, competitive research, GTM
│   └── creative/          # concepts, campaigns, copy
```

**Hub `CLAUDE.md`** must contain, in order: what this is (one paragraph) → the two-location table + remote → the **ethos block** (below) → planned architecture → conventions (dev-server port rule, latest Claude models, beads, session logging via `/takeoff`) → key-docs index → status.

The Bible, Flight Recorder, and (if applicable) Tome are **not** hand-created here — Step 2 installs them via their owning skills.

## Step 2 — Durable-memory surfaces (delegate to the real skills)

All created in the **hub root** (`S:\<company>\<project>`), so `/takeoff` / `/landing` run against them.

**2a. Flight Recorder — via `flight-deck`.** Run `/takeoff init-recorder` in the hub. In the wizard, set:
- `multi_user: true` (the hub is shared — every teammate's `/takeoff` writes their own `FLIGHT-LOG.<user>.md`, and the shared `FLIGHT-RECORDER.md` attributes each entry `by: <user>`). See flight-deck `references/MULTI-USER.md`.
- Lenses to fit the project (Technical + Journey + Patterns is the usual default).

This produces the real `.flight-recorder.yml` + `FLIGHT-RECORDER.md` — not a hand-authored log.

**2b. Bible — via `bible-keeper`.** Invoke `/bible-keeper` setup so the project gets a genuine `.bible-keeper.json` + `BIBLE*.md` decision log (owned by bible-keeper, so `/bible-keeper` batch-scan works at every takeoff). Seed it with the founding decisions already made during exploration.

**2c. Tome — via `canon-keeper` (conditional).** ONLY if this is an **ecosystem** (multiple repos/sites/lore that must stay consistent). Invoke `/canon-keeper` to scaffold a `TOME.md` (+ `TOME-LOG.md` + keeper agent). Skip for a single-surface build — a Tome there is overkill (flight-deck will still *offer* one later if the project grows into one).

> These three are the surfaces flight-deck's own takeoff/landing detect and keep in sync. Installing them here at birth means `/takeoff` has real targets from session one.

## Step 3 — Task OS (beads) — shared-drive-safe

Use the **beads-team-setup** skill's guidance — do NOT init a live Dolt DB on the S: shared drive (that wedges; it's the documented failure beads-team-setup exists to prevent). Instead use the **global** beads DB with a project label:

```bash
cd ~/.claude/beads
bd create --title="<Project> v1 (epic)" --description="..." --type=feature --priority=1 --label project:<slug>
# then the first spikes/decisions/tasks, priority 1-3, all --label project:<slug>
```

Convert the Bible's open questions and the obvious first spikes into issues. Prefer 1-2 de-risking **spikes** at P1 over a long flat list. For a genuinely multi-machine shared board, follow **beads-team-setup** in full.

## Step 4 — Scaffold the code home (C:) + repo

```bash
mkdir -p "~/projects/_<COMPANY>/<project>"/{<layer-folders>}
# write README.md, CLAUDE.md (short pointer to hub + ethos), .gitignore
cd "~/projects/_<COMPANY>/<project>"
git init -b main && git add -A && git commit -m "Scaffold <project> code home"
gh repo create <org>/<project> --private --source=. --remote=origin --push
```

Layer folders follow the project's architecture (e.g. `app/ server/ display/`). Add `.gitkeep` to empty ones. The code-home `CLAUDE.md` is a short pointer back to the hub plus the ethos + conventions. Commit messages end with the co-author trailer per global rules.

## Step 4b — Env & secrets (secrets manager, never commit)

None of the surfaces above (recorder/bible/tome/beads/CoS) use secrets — this step is only for the **app's own runtime env**. You usually don't know the full var list at ignition, so scaffold the convention, not the values:

- **`.gitignore`** already lists `.env` (verify it does) — real secrets never get committed. Hard rule.
- **`.env.example`** (committed) — a documented placeholder list of the vars the app will need. Seed it with whatever's already known (e.g. `DATABASE_URL=`, `ANTHROPIC_API_KEY=`), empty values + a comment per var. This is the human-readable contract.
- **Real values come from a secrets manager (e.g. 1Password, Vault, Doppler), not hand-typed.** Most managers offer both an inject-to-file and an inject-at-runtime pattern — pick per project. For example, with the 1Password CLI (`op`):
  - `op inject -i .env.example -o .env` — where `.env.example` lines use `op://<vault>/<item>/<field>` secret references; resolves to a real gitignored `.env`.
  - `op run --env-file=.env.example -- <cmd>` — injects at runtime, no plaintext `.env` on disk (preferred for CI / servers).
- **Code-home `CLAUDE.md`** gets a one-line secrets note: *"Secrets live in your secrets manager. Never commit `.env`. Populate from the manager (e.g. `op inject` / `op run` for 1Password)."*
- **No secrets-manager CLI installed?** Degrade gracefully: keep the committed `.env.example` contract, and have the user populate a gitignored `.env` by hand (or via whatever secrets manager they do use). The hard rule is unchanged — real secrets never get committed — only the *population mechanism* is optional. Don't block scaffolding on a CLI being present.

For a client project, prefer the client's own dedicated vault if one exists, rather than a shared team vault.

## Step 5 — Client Chief-of-Staff agent (conditional) — via `client-assistant`

**ONLY if this is a client project.** Invoke `/client-assistant` to stand up the named CoS persona (the "Robin for Acme Store" pattern) in the **hub** (the client coordination home). It generates:
- `CLAUDE.md` persona (auto-loads each session; signs client comms as the assistant on behalf of the principal),
- `memory/client-interactions.md` (interaction log),
- `memory/deliverables-tracker.md` (deliverables tracker).

Give it the client company/contact, assistant name, and tone from recon. If the hub already has a project `CLAUDE.md` from Step 1, client-assistant's persona layers on top / merges — reconcile so the persona and the project instructions coexist (persona voice + project conventions), don't clobber Step 1's conventions.

## Step 6 — Capture to persistent memory

Write to the project memory dir (`~/.claude/projects/<slug>/memory/`):
- A **project** memory: what it is, thesis, architecture, status, artifact locations (hub path, code path, repo URL), whether it's a client project (+ CoS agent name), and which durable surfaces exist.
- Any **durable principle/ethos** as its own file, linked with `[[wikilinks]]`.
- Add one-line pointers to `MEMORY.md`.

## The product ethos block (paste into every hub + code CLAUDE.md)

> Hard design constraints, not marketing:
> 1. **Collect only what's needed to run it** — no surveillance, no "just in case" data.
> 2. **Never sell or repurpose user data** — no ad networks/brokers/third-party marketing. Privacy is structural (prefer local-first / self-hostable / one-way).
> 3. **Monetize by fair value exchange** — no dark patterns, no hidden revenue, no lock-in that bricks paid hardware.
> 4. **Human-friendly = built for non-technical people** — effortless setup, zero tinkering; hide all technical setup behind a turnkey flow.

Tune wording per project, but every product inherits these.

## Completion checklist

- [ ] Hub has README, CLAUDE.md, docs/{strategy,creative}
- [ ] Existing exploration artifacts moved into the hub
- [ ] Flight Recorder installed via `/takeoff init-recorder` (real `.flight-recorder.yml`, `multi_user: true`)
- [ ] Bible installed via `/bible-keeper` (real `.bible-keeper.json` + `BIBLE*.md`), seeded with founding decisions
- [ ] Tome installed via `/canon-keeper` **if ecosystem** (else deliberately skipped)
- [ ] beads backlog filed on the **global** DB with `--label project:<slug>` (no live Dolt on S:)
- [ ] Code home created with layer folders, README, CLAUDE.md, .gitignore (with `.env` ignored)
- [ ] `.env.example` committed with known vars; secrets convention (your secrets manager) noted in CLAUDE.md; no real `.env` committed
- [ ] Private GitHub repo created under the chosen org and pushed
- [ ] Client CoS agent scaffolded via `/client-assistant` **if client project** (else N/A)
- [ ] Ethos block present in both CLAUDE.md files
- [ ] Project + ethos captured to persistent memory
- [ ] CLAUDE.md references the real repo URL (no "TBD")
```
