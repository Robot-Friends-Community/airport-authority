# Multi-User / Team Mode

Flight Deck supports more than one person working the **same project folder** (a shared drive, a Syncthing-synced repo, a cloned team repo) without their takeoffs and landings squashing each other.

The core idea: **session state is personal, the build log is shared-but-attributed.** Your `FLIGHT-LOG` is yours alone; the `FLIGHT-RECORDER` is the whole team's, with every entry stamped with who wrote it.

---

## 1. Resolving the current user

Do this **once, at the very start of every `/takeoff` and `/landing`**, before touching any file. The result is a slug `<user>` matching `[a-z0-9-]+`.

**Resolution order — first hit wins:**

1. `~/.claude/skills/flight-deck/config.yml` → `user_id:` — the authoritative, set-once identity for this machine's user.
2. `git config user.name` (project-local, then global) → slugify.
3. OS username — `$USER` (bash) / `whoami` / `%USERNAME%` (Windows).
4. If nothing resolves (rare), prompt **once**:
   ```
   Who's flying this session? [suggested-slug]
   ```
   Write the answer to `config.yml` `user_id:` so it is never asked again.

**Slugify:** lowercase → replace every run of non-`[a-z0-9]` with a single `-` → trim leading/trailing `-`. Keep it short; a first name is ideal.
- `"Sam Rivera"` → `sam-rivera`
- `"alex@example"` → `alex-example`
- `"Jordan V."` → `jordan-v`

**The identity names the PERSON, not the machine.** If one person works from two machines, set the same `user_id` on each so their logs converge instead of forking into `jordan` / `jordan-laptop`.

---

## 2. File model

| File | Scope | Multi-user behavior |
|------|-------|---------------------|
| `FLIGHT-LOG.<user>.md` | **per-user** session state | One per person. A takeoff only ever writes/overwrites *your own*. Teammates' logs are never touched. |
| `FLIGHT-RECORDER.md` | **shared** project build log | ONE file for the whole project. Each entry is attributed `by: <user>`. A single project-wide `session_count`. |
| `.flight-recorder.yml` | **shared** project config | Shared. `session_count` is the project-wide counter, not per-user. |
| `config.yml` | **per-user / per-machine** | Holds *your* `user_id` and local paths. Never committed to a shared repo (gitignored). |
| `TOME.md` / `BIBLE*.md` | canon-keeper / bible-keeper | Owned by those skills. Flight Deck delegates and passes `<user>` through for attribution (see §5). |

**Why the split:** a flight log answers *"where was **I**?"* — inherently personal, and the thing that got squashed. The recorder answers *"what happened to this **project** and why?"* — inherently collective, so it stays one timeline that everyone reads, just with authorship attached.

---

## 2.5. The lane axis (one person, many terminals)

Per-user logs stop **different people** from squashing each other. But one person can run **many terminals on the same repo at once** — 8 windows, each on a different workstream (Sales, Website, Notifications…). All resolve to the *same* `<user>`, so they'd all write one `FLIGHT-LOG.<user>.md` and squash — the same problem, one axis over.

The **lane** is an optional second shard: a short workstream tag that splits the log per-terminal.

| No lane (default, unchanged) | Lane set |
|------------------------------|----------|
| `FLIGHT-LOG.<user>.md` | `FLIGHT-LOG.<user>.<lane>.md` |

`<lane>` is slugified exactly like `<user>` (lowercase, `[a-z0-9-]+`). Example: `FLIGHT-LOG.alex.sales.md`, `FLIGHT-LOG.alex.website.md`.

### Resolving the lane — first hit wins; **no signal → no lane** (default behavior is untouched)

1. **`FLIGHT_DECK_LANE` environment variable.** The clean per-terminal signal: a variable naturally lives in exactly one terminal, so 8 terminals with 8 different values = 8 lanes automatically. Set-and-forget (in a terminal profile, or `FLIGHT_DECK_LANE=sales` when opening the window). This is the primary mechanism.
2. **A lane declared in-session.** The user can say *"this is the sales lane"* at any point; carry that lane for the rest of this session's takeoffs/landings. This is **ephemeral by design** — it lives in the session's context, not a file (see the note below on why). After a `/clear`, either the env var covers it or the user re-declares.
3. **No env var, no declaration → no lane.** Write `FLIGHT-LOG.<user>.md` exactly as before. The lane axis is purely additive; single-terminal users never see it.

**When to proactively ask (the "else ask" half — don't nag):** do **not** prompt for a lane on a normal solo takeoff. Offer one only when the squash risk is real and visible:
- You're about to overwrite an existing `FLIGHT-LOG.<user>.md` whose in-progress objective clearly belongs to a **different** workstream than this session, **or**
- Sibling lane logs (`FLIGHT-LOG.<user>.*.md`) already exist in this folder but this session has no lane set.

Then a one-line, declinable offer: `This repo looks like it has parallel workstreams. Tag this terminal's lane so it doesn't overwrite the others? (e.g. "sales") [lane / skip]`. On skip, proceed with the default and don't re-nag this session.

### Why not a `.flight-lane` file in the repo?

A file committed/placed in the project is **shared by every terminal open on that repo** — so it can't tell the 8 terminals apart, which is the entire problem. The signal has to be *per-terminal*, and an environment variable is exactly that. (A gitignored per-terminal file would work but is just a clumsier env var.) That's why the lane lives in the environment or the live session, never in a repo file.

### Landing, /tower, and seeing the whole board

Glob `FLIGHT-LOG.*` (the `[.-]` separator, so dash-named and lane logs are both visible). Land into **your own resolved lane** (`FLIGHT-LOG.<user>.<lane>.md` if a lane is set, else `FLIGHT-LOG.<user>.md`, else legacy). List the *other* lanes and users present so you see who/what else is live in the folder — but restore only from your own.

---

## 3. The `multi_user` toggle

`.flight-recorder.yml` may carry:

```yaml
multi_user: true    # default when unset
```

- **`true` (default):** per-user `FLIGHT-LOG.<user>.md` naming + `by:` attribution on recorder entries. Safe in every case — solo projects just get a single `FLIGHT-LOG.jordan.md`.
- **`false`:** legacy single `FLIGHT-LOG.md`, no attribution. For a solo user who wants no suffix and knows the folder will never be shared.

When unset, treat as `true`. Recorder attribution (`by:`) is cheap and harmless even solo, so it is always applied when `multi_user` is not explicitly `false`.

---

## 4. Legacy migration (first multi-user takeoff in an existing project)

A project built before multi-user mode has a plain `FLIGHT-LOG.md` and an unattributed `FLIGHT-RECORDER.md`. Handle gracefully — never destroy prior state:

- **Takeoff:** write `FLIGHT-LOG.<user>.md` going forward. A legacy `FLIGHT-LOG.md` may be migrated by renaming it to `FLIGHT-LOG.<user>.md` — but **never rename it silently**, and never rename these two kinds:
  - **A router / index `FLIGHT-LOG.md`.** Some users keep a hand-rolled `FLIGHT-LOG.md` that is *not* a session handoff but a **table of contents pointing at other flight logs** (lane logs, per-stream logs). Signs: it links to or lists multiple other `FLIGHT-LOG*` files, has no single-session frontmatter (`objective`/`progress`/`next action`), or reads as an index. Renaming it would orphan every log it points at and break the user's landing path. **Leave it untouched.**
  - **Someone else's handoff.** If the author is unknown or clearly not you, leave it and just write your own.
  - Otherwise — it looks like *your own* prior single-session handoff — **ask before renaming**: `Found a legacy FLIGHT-LOG.md that looks like your earlier handoff. Rename it to FLIGHT-LOG.<user>.md? [Y/n]`. On decline, leave it and write your own alongside. The migration is a convenience, never a silent mutation.
- **Landing:** still read legacy `FLIGHT-LOG.md` as a fallback when no `FLIGHT-LOG.<current-user>.md` exists — unless it is a router/index (above), in which case follow its pointers rather than loading it as a handoff.
- **Recorder:** no migration needed. Old entries simply lack a `by:` line; new ones add it. Never rewrite historical entries to backfill authorship.

---

## 5. Passing identity to Tome / Bible

Tome (`TOME.md`, canon-keeper) and Bible (`BIBLE*.md`, bible-keeper) are separate skills that Flight Deck delegates to during the takeoff Bible/Tome-Sync step. For multi-user attribution:

- When invoking `/canon-keeper takeoff` or `/bible-keeper`, **pass `<user>`** so those entries can be attributed (e.g. mention "session by `<user>`" in the summary handed over).
- Those skills own their own file layout. Flight Deck does not rename or shard their files — it only supplies the author. Deeper multi-author handling for the Tome front page (merge, not overwrite, a teammate's Open Threads) is a canon-keeper concern, tracked there, not here.

---

## 6. Concurrency on shared / synced folders

Per-user `FLIGHT-LOG` files **never collide** — that is the whole point, and it fully solves the stated "squash" problem.

The shared `FLIGHT-RECORDER.md` is append-only but still shared, so two people taking off within seconds on a Syncthing/shared drive can race the append and the `session_count` bump. Mitigations:

- The **append-then-verify-then-bump** discipline in `HANDOFF.md` Step 4 already applies. Additionally, **re-read `FLIGHT-RECORDER.md` and `.flight-recorder.yml` immediately before appending** to get the true latest `session_count` — never trust a value cached earlier in the session.
- **Detect sync-conflict artifacts.** On both takeoff and landing, if files like `FLIGHT-RECORDER.sync-conflict-*.md`, `*.conflicted.md`, or `.flight-recorder.sync-conflict-*.yml` sit next to the real files, **flag them for manual merge** and do not blindly append over a possibly-stale copy.
- Human takeoffs are minutes-apart actions in practice; the residual race is small and always recoverable (counter behind content — backfill), never a destroyed log.
