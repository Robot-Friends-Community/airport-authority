---
name: beads-team-setup
description: Set up beads (bd) correctly for a SHARED / multi-user / multi-machine project so it never wedges, plus diagnose and recover a beads/Dolt server that is already stuck. USE WHEN starting beads on a team project, when "multiple people need to use beads", "share the board across machines", "assign each other beads", "who created this bead / attribution", OR when bd is broken with "Dolt server unreachable", "database is locked by another dolt process", "server started but not accepting connections", "beads won't start", "dolt locked", or a board lives on a network/shared drive (S:, G:, NAS, SMB). Encodes the hard-won lesson: never run a live Dolt DB off a shared network drive.
---

# Beads Team Setup

Beads (`bd`) is great solo. It bites HARD when a team points multiple machines at **one Dolt database on a shared network drive** — which is the default trap. This skill sets it up the right way, and recovers a board that's already stuck.

## The one hard rule

> **NEVER put a live Dolt database on a shared network drive (S:, G:, a NAS, any SMB/UNC path) that more than one machine runs `bd` against.**

Why it fails (the exact failure this skill exists to prevent):
1. Dolt is **single-writer** — it takes an exclusive OS lock on the storage.
2. `bd` **auto-starts its own Dolt server** the first time any command runs.
3. So two machines = two servers fighting for one lock → `database "dolt" is locked by another dolt process`.
4. Worse over SMB: Dolt reading its chunk-store over a network share takes **~12s to accept connections**, but bd's auto-start **gives up at ~10s** and reports failure *while the server keeps starting*. The next bd call spawns ANOTHER server that collides with the still-starting one → a self-inflicted pile-up of half-dead servers, each reported as a "lock." Force-killing them looks like a stale lock but isn't.

The JSONL auto-export is **NOT** cross-machine sync (bd's own docs: *"It is not cross-machine sync; use bd dolt push/pull with a Dolt remote"*). Don't rely on a shared `issues.jsonl` as the live board.

## ⚠️ FIRST: verify your bd build actually supports no-db (many don't)

`no-db` is documented in `config.yaml` but **some installed builds ignore it** — bd still requires/auto-starts Dolt regardless. **Verified 2026-08-04 on the RF winget build (then `SteveYegge.Beads`, since renamed `GasTownHall.Beads`): `no-db: true` was NOT honored** (bd kept using Dolt; setting `dolt.auto-start: false` on top only made bd fail with "unreachable"). So **do not assume Model A works — test it on a scratch board first:**
```bash
mkdir /tmp/nodb-test && cd /tmp/nodb-test
bd init --prefix test && printf 'no-db: true\n' >> .beads/config.yaml
# with NO dolt running:
powershell -c "Get-Process dolt -ea SilentlyContinue | Stop-Process -Force"
bd create --title="x" --type=task   # if this works with zero dolt -> no-db IS supported
```
If bd errors with "Dolt server unreachable" / tries to auto-start Dolt → **no-db is not supported in your build. Use Model B, or upgrade bd first.**

## ⚠️ Minimum bd version for a shared server (Model C): use the winget build (≥ 1.1.2)

Everyone hitting a shared Model-C server must be on a **modern bd** — the winget build (`GasTownHall.Beads`, renamed from `SteveYegge.Beads`; ≥ 1.1.2). An **old/manual build** (seen 2026-08-06 with a hand-compiled `0.59.0`) fails against a server-board created by a newer bd, in two ways that *look* like a credential or grant problem but aren't:

1. **No `.beads/.env` auto-load** → bd sends **no password** → `Error 1045 (28000): Access denied for user 'root'`. Identical to a wrong password from the client side, so it burns time on grants/1Password when the real cause is the bd version. (The `.env` auto-load is confirmed on the winget build; it does not exist in 0.59.0.)
2. **Schema mismatch on connect** → even once you supply the password in-process, an old bd tries to **initialize schema** against the shared board and fails building the `ready_issues` view: `Error 1105 (HY000): table "d" does not have column "depends_on_id"` — the modern board's `dependencies` table uses `depends_on_issue_id`, not the old `depends_on_id`.

**Good news / bad news:** a failed schema-init from an old client is **self-contained** — its `CREATE ready_issues view` errors *without replacing* the existing good view, so it can't corrupt the shared board (verified: 556-issue board intact after a 0.59.0 hit). But don't rely on that as a safety net — **gate the version instead.**

**Fix:** `winget install --id GasTownHall.Beads` (or `winget upgrade --id GasTownHall.Beads`) to ≥ 1.1.2, then re-run the connect. (If an old install still shadows it, the winget `Links/bd` shim and the `GasTownHall.Beads` package dir hold the new build — rename any stale `bd` earlier in PATH, e.g. a hand-built `~/.local/bin/bd` or a leftover `SteveYegge.Beads` package `bd.exe`, to `.bak`.) Onboarding a teammate to a Model-C board? Confirm their `bd version` **first** — a clear "upgrade bd" beats a day lost to "Access denied."

## Pick the model (decision table)

| Situation | Model | Why |
|---|---|---|
| **Team + an always-on server** (homelab, VPS) all machines can reach | **C. one shared external Dolt `sql-server`** (BEST when available) | Real-time concurrent access, no push/pull friction, no shared on-drive DB. The server owns the single-writer lock on its own local disk. |
| **Team, multiple machines, no shared server** | **B. local Dolt per machine + a shared Dolt remote** | Beads-native multi-user. Each user's Dolt lives on their **own C: drive**, synced via a remote (DoltHub or self-hosted). |
| Small team, simple needs, already using git, **bd build supports no-db** | **A. JSONL-only + git** | Zero Dolt, zero lock, ever. Board = `issues.jsonl` in a git repo; sync = `git pull/push`. ⚠️ Many builds ignore `no-db` — test first (above). |
| **Solo, one machine** | Local Dolt on a **local disk** (C:), not a share | Fine as-is. The trap only appears with sharing + network drive. |

**Default recommendation:** if the team has **any always-on box everyone can reach (a homelab or a VPS), use Model C** — it's the only model that gives true real-time concurrent access with zero sync ceremony, and it's not blocked by the no-db gap. Fall back to **Model B** (Dolt remote) if there's no shared server, or **Model A** only if you've verified your bd build honors `no-db`.

> **RF status (2026-08-05):** **Model C is now the RF reference topology.** The Acme board runs on a shared Dolt `sql-server` on the Proxmox homelab (`curative01-1`), reachable over Tailscale — see the Model C recipe below (this is the exact working setup). Model A stays blocked: the installed winget bd build does NOT honor `no-db` (verified 2026-08-04). Don't attempt a live no-db flip on a production board.

## Setup — Model C (shared external Dolt sql-server), BEST for teams with an always-on box

This is the RF reference topology, proven on the Acme board (2026-08-05). One always-on Dolt server; every machine connects to it over a private network (Tailscale). No shared on-drive DB, no push/pull, real concurrent access.

**1. Run the server on the always-on box's LOCAL disk** (never the network share). Docker matches most homelab setups — a compose stack:
```yaml
# /opt/stacks/beads-dolt/docker-compose.yml
services:
  beads-dolt:
    image: dolthub/dolt-sql-server
    container_name: beads-dolt
    restart: unless-stopped
    ports:
      - "<TAILSCALE_IP>:9330:3306"   # bind to the Tailscale IP ONLY -> tailnet-reachable, not LAN/public
    volumes:
      - ./data:/var/lib/dolt          # local disk on the host
    environment:
      - DOLT_ROOT_PASSWORD=${DOLT_ROOT_PASSWORD}   # from a gitignored .env next to the compose
      - DOLT_ROOT_HOST=%              # allow remote root (the private network is the gate)
```
Binding to the Tailscale IP (not `0.0.0.0`) means only tailnet members reach it; the tailnet ACL is your access control. Store the root password in your secrets manager (1Password).

**2. Point each machine's board at it** — the connection lives in `.beads/metadata.json`:
```json
{ "database":"dolt", "backend":"dolt", "dolt_mode":"server",
  "dolt_server_host":"<TAILSCALE_IP>", "dolt_server_port":9330,
  "dolt_server_user":"root", "dolt_database":"<prefix>", "project_id":"<uuid>" }
```
bd creates **one database per prefix**, so one server hosts many projects cleanly. Init a fresh board with `bd init --server --server-host <ip> --server-port 9330 --server-user root --prefix <p>`, or repoint an existing one by writing these keys into `metadata.json` (back up the old one first).

**3. Password without typing it every shell:** bd **auto-loads `.beads/.env`** (already gitignored). Put `BEADS_DOLT_PASSWORD=…` there once. Confirmed working on the winget build.

**4. Migrate an existing board in** (JSONL round-trip — preserves issues + memories, not Dolt history):
```bash
bd export --all -o board.jsonl                 # from the old board (552 issues + memories)
# init the new server board (step 2), then:
bd import -i board.jsonl                        # imports issues AND memories
bd stats                                        # verify counts match the source exactly
```
Keep the old setup in place as a fallback until verified (back up `metadata.json` + the pre-migration export).

**5. Gotchas that bit us:**
- A stale `.beads/dolt-server.port` file can override the metadata port. When repointing from a local server, move the local-server trackers aside: `mv .beads/dolt-server.{port,pid,lock,activity} .bak`.
- Everyone needs the private network up (Tailscale) — that's the only client-side dependency. If the server is unreachable, check the stack is up (`docker ps | grep beads-dolt`) before assuming a bd bug.
- Disk: the server's host needs headroom; the DB itself is tiny (hundreds of issues ≈ MBs), but watch the host's root usage.

## Setup — Model A (JSONL-only + git), only if your build honors no-db

1. Put the beads git repo on **GitHub**, not (only) the shared drive. One repo per project board (e.g. `org/beads` or `org/<project>-tasks`).
2. In `.beads/config.yaml`:
   ```yaml
   no-db: true            # JSONL is the source of truth; no Dolt server, no lock
   issue-prefix: "gp"     # your project prefix
   ```
3. Each user clones the repo locally (C:), runs bd against their **local** clone, and syncs with `git pull --rebase` / `git push`. Beads' JSONL is line-per-issue and merges cleanly; resolve the rare conflict like any git conflict.
4. **Never** point two machines' `BEADS_DIR` at the same copy on a network share. Each machine = its own local clone.

## Setup — Model B (local Dolt + Dolt remote)

1. Each user's board lives in a **local** `.beads` on C: (not the share).
2. Create a shared Dolt remote once: `bd dolt remote add origin <dolt-remote-url>`.
3. Workflow: `bd dolt pull` before work, `bd dolt push` after. Each user's local server never contends with anyone else's.

## Per-user identity — so "who created it" actually works

By default every bead's `created_by` is whatever single `actor` the config has (on the Acme board today it's all `your-team`, because every session wrote under one identity). For real attribution:

- Set a **distinct actor per person** on each machine — env var `BD_ACTOR` (e.g. `jordan`, `alex`, `robin`) or `actor:` in that machine's config, or `--actor` per call.
- Then `created_by` + the event audit trail (`events.jsonl`, enable `events-export: true`) show who did what.

**Assignment already works regardless of the above:** `bd update <id> --assignee=alex`; each person runs `bd ready --assignee=<name>` for their queue. Adopt a name convention (`jordan`/`alex`/`sam`/`robin`) and use it consistently.

## The BEADS_DIR hijack (bites even after everything else is right)

A user-wide `BEADS_DIR` env var **overrides local `.beads/` auto-discovery in every directory.** A plain `bd ready` then answers from the GLOBAL board, not the project — silently. Always prefix project bd calls:
```bash
BEADS_DIR="/path/to/project/.beads" bd ready
```
If `bd ready` returns the wrong prefix (e.g. `beads-` instead of `acme-`), that's the hijack.

## When it's already stuck — recovery playbook

Full step-by-step in **[references/recovery-playbook.md](references/recovery-playbook.md)**. The 30-second version:

0. **`Access denied for user 'root'` or a `ready_issues` / `depends_on_id` schema error on a Model-C board is a bd VERSION gap, not a lock or a bad credential** — check `bd version` and upgrade to the winget build (≥ 1.1.2) *before* touching grants or 1Password (see the minimum-version section above).
1. **Don't trust "locked" at face value.** Check for live Dolt on ALL machines: `Get-Process dolt`. If **zero** dolt.exe anywhere yet still "locked," it's almost always the **slow-start-over-SMB pile-up**, not a dead-process lock.
2. **Prove it:** start Dolt manually on a fixed port with real patience, and watch the log:
   ```bash
   cd <.beads>/dolt
   dolt sql-server -H 127.0.0.1 -P 47700 -l warning &   # give it ~15s
   ```
   - Comes up in ~12s with no "locked" line → it was the **timeout**, not a lock. Point bd at it: `printf '47700' > <.beads>/dolt-server.port` then `bd ready`.
   - Still "locked by another dolt process" with a genuinely live server elsewhere → find and stop that server.
3. **Rescue the data BEFORE any model change:** `bd export --all -o issues.jsonl` (back up the old one first — a stale export can be months behind and will silently lose work if you flip to JSONL-only on top of it).
4. Truncate a bloated `dolt-server.log` (`: > dolt-server.log`) — failed starts spam it to MBs.
5. Then migrate to Model C (or B/A) so it stops recurring.

## Hand-off / integration

- Reference this skill from `project-kickoff`, `repo-bootstrap`, and any engagement-scaffolding flow: **"if the project uses beads and more than one person will touch it, run beads-team-setup and pick a model — Model C (shared external Dolt sql-server) if there's an always-on box everyone can reach, else Model B (Dolt remote), or Model A only if your bd build honors no-db. Never leave the live Dolt DB on a shared drive."**
- The RF global CLAUDE.md documents the `BEADS_DIR` prefix rule per-project; this skill is the *why* and the *fix*.
