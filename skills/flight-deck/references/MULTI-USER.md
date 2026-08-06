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

- **Takeoff:** write `FLIGHT-LOG.<user>.md` going forward. If a legacy `FLIGHT-LOG.md` exists **and** it is the current user's own prior handoff (single-author project — its content matches your work, or you're the only person here), rename it to `FLIGHT-LOG.<user>.md`. If its author is unknown or clearly someone else, **leave it untouched** and just write your own.
- **Landing:** still read legacy `FLIGHT-LOG.md` as a fallback when no `FLIGHT-LOG.<current-user>.md` exists.
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
