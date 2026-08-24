# Recovery Mode — resume after an unclean exit

The normal `/landing` assumes the previous session ended with a clean `/takeoff`, so
the handoff + recorder describe reality. **Recovery mode is for when it didn't** — the
session crashed, was `/exit`-ed by accident, or otherwise closed without a takeoff, so
the repo moved but the durable memory froze. The job is to find what the dead session
actually did, recover anything unsaved, and rebuild the missing record — *before* a
normal resume, so you never `/landing` onto a lie.

## When to enter recovery mode

Trigger on ANY of:
- SessionStart shows a **flight-recorder-warning** ("session ended without /takeoff").
- The user says "recover", "pick up after a crash", "I exited by accident", "help me
  recover", or otherwise signals an unclean prior exit.
- `/landing` detects an **unclean-exit fingerprint**:
  - the newest `FLIGHT-RECORDER.md` entry is **older than the newest git commit**
    (repo moved, memory didn't), or
  - `FLIGHT-LOG.<user>.md` is older than HEAD, or
  - `.flight-recorder-warning.json` exists in the project root.

If none of these hold, do the normal `/landing`.

## The routine

Do NOT assume anything was lost until you've checked. An unclean exit rarely destroys
**committed** work — the only genuinely losable things are (a) the recorder narrative
and (b) untracked deliverables still on disk. Work the evidence in this order:

**1. Establish last known-good.** Read the last 1–2 `FLIGHT-RECORDER.md` entries and the
   `FLIGHT-LOG`. That is where the record *thinks* you were — the baseline to diff reality against.

**2. Place the crash on the timeline.**
   ```bash
   git log --date=iso -12 --format='%h %cd %s'
   ```
   Commits **after** the last recorder entry's timestamp are work the dead session did
   but never narrated. Those are already safe — note them for the reconstructed entry.

**3. Classify every untracked / uncommitted file by MTIME — not by assuming loss.**
   ```bash
   git status --porcelain
   # then stat the mtimes of untracked files
   ```
   - Modified **during the dead session's window** → candidate recovered work.
   - **Older** than the last recorder entry → pre-existing (parked / unrelated). Do NOT
     treat it as this-session output. (This is the step that stops a recovery from
     "rescuing" files that were never part of the crash.)

**4. Separate deliverables from build artifacts via `.gitignore` intent.** A whitelisted
   output (e.g. a final master the ignore rules force-track) that is sitting **untracked**
   is real work at risk → validate and commit it. Gitignored intermediates/renders are
   regenerable → leave them.

**5. Validate surviving media before trusting it.** A crash can truncate a file mid-write.
   `ffprobe` (video/audio: codecs, duration, not truncated) and, where it matters,
   `volumedetect`/`loudnorm` checks. **Only commit or act on files that verify complete.**

**6. Recover.** Commit the validated deliverables — small, labelled, one logical unit each
   (e.g. "recover final master left untracked at unclean exit"). This is the actual rescue.

**7. Reconstruct the missing record from git.** Run `/takeoff` and write the dead session's
   recorder entry **from the commit history + artifacts**, marked `[reconstructed]`, rather
   than losing the session. Reconcile `session_count` and the central index as usual.
   Clear `.flight-recorder-warning.json` once the entry is written.

**8. Report plainly.** Four buckets, no spin:
   - **Already safe** — committed before the crash.
   - **Recovered** — was unsaved on disk, now committed.
   - **Lost** — usually only the recorder narrative (now backfilled). Say so if truly nothing.
   - **Pre-existing / left alone** — the older untracked files you deliberately did not touch.

## The lesson to bank

Commit-at-checkpoints is what turns a crash into a non-event: because completed work was
committed as it finished, the blast radius of an unclean exit shrinks to the narrative
(reconstructable) plus any untracked deliverable (recoverable on disk). Recovery mode is
the safety net; frequent commits are what make the net rarely needed.
