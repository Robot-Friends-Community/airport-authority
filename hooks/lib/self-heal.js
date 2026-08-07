/**
 * Airport Authority — bounded self-heal  (Flight Ops, v1.1 Component 3).
 *
 * Scope, ratified by the user 2026-08-06: TIER A ONLY. Self-heal is confined to
 * Airport Authority's OWN session-state directory. It never touches your work
 * product, the repository, or git history.
 *
 * Safety contract — EVERY action in this module satisfies all five:
 *   1. Reversible or idempotent — a corrupt file is PRESERVED as a timestamped
 *      .bak before its live path is freed; the orphan prune only removes files
 *      already past the shared 30-day dead-orphan policy (a second pass is a
 *      no-op).
 *   2. Touches ONLY AA bookkeeping — files under
 *      ~/.claude/airport-authority/state/*.json. Nothing else.
 *   3. Offline, never throws — pure fs, no network. A hook must never crash a
 *      session, so every operation is wrapped and failures degrade to "skip".
 *   4. Announces every action — returns a record the caller surfaces inline,
 *      and logs each action to hooks.log. Never silent.
 *   5. Outbound / destructive actions (commit, push, merge, deploy, deleting a
 *      user file, rewriting history) are FOREVER out of scope. Those remain
 *      surfaced suggestions per the flight-engineer contract — never auto-run.
 *
 * A single SessionStart "janitor" pass (tidyStateDir) both quarantines corrupt
 * state files and reports dead-orphan prunes, so the suite's own bookkeeping
 * self-repairs at the session boundary instead of silently rotting or being
 * silently clobbered. This module DETECTS + ACTS and returns a record; the
 * caller (flight-status.js) surfaces it — mirroring how probe.js stays pure.
 */

const fs = require('fs');
const path = require('path');
const { STATE_DIR, STALE_MAX_AGE_MS, log } = require('./session-state');

/**
 * Path for the preserved copy of a corrupt state file. Timestamped so repeated
 * corruption never overwrites an earlier capture — every original stays
 * recoverable (contract #1). ':' and '.' are stripped from the ISO stamp
 * because ':' is illegal in Windows filenames.
 */
function quarantinePath(filePath) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${filePath}.corrupt-${stamp}.bak`;
}

/**
 * One janitor pass over Airport Authority's own state directory. Never throws.
 *
 * Ordering note: prune-by-age is checked before parse, so a file that is BOTH
 * dead-old and corrupt is simply pruned (the older, stricter action wins) — we
 * do not bother preserving a month-dead corpse.
 *
 * Concurrency note: writeState uses write-temp + atomic rename, so a live
 * session's .json is never observed half-written. A file that fails to parse is
 * therefore genuinely corrupt, not a mid-write race — safe to quarantine. If it
 * belonged to another live session, that session's next writeState simply
 * recreates its path; the preserved .bak loses nothing.
 *
 * @param {object} [opts]
 * @param {number} [opts.maxAgeMs] dead-orphan cutoff (default: shared 30 days)
 * @returns {{quarantined: string[], pruned: string[]}} basenames acted on
 */
function tidyStateDir(opts = {}) {
  const maxAgeMs = opts.maxAgeMs != null ? opts.maxAgeMs : STALE_MAX_AGE_MS;
  const result = { quarantined: [], pruned: [] };
  try {
    if (!fs.existsSync(STATE_DIR)) return result;
    const now = Date.now();

    for (const name of fs.readdirSync(STATE_DIR)) {
      if (!name.endsWith('.json')) continue; // ignore .bak captures + anything else
      const fp = path.join(STATE_DIR, name);

      let stat;
      try {
        stat = fs.statSync(fp);
      } catch (_) {
        continue; // vanished between readdir and stat — nothing to do
      }
      if (!stat.isFile()) continue;

      // A2: prune a dead orphan already past the 30-day policy. Idempotent —
      // a second pass finds nothing. Same cutoff as sweepStale, now announced.
      if (now - stat.mtimeMs > maxAgeMs) {
        try {
          fs.unlinkSync(fp);
          result.pruned.push(name);
          log('aa-heal', `pruned dead orphan state file: ${name}`);
        } catch (err) {
          log('aa-heal', `prune failed for ${name}: ${err.message}`);
        }
        continue;
      }

      // A1: quarantine a corrupt (unparseable) state file. The original is
      // PRESERVED as a .bak (reversible); the live path is freed so the
      // SessionStart stamp can write valid state back in its place.
      let raw;
      try {
        raw = fs.readFileSync(fp, 'utf8');
      } catch (_) {
        continue; // unreadable this instant — leave it, retry next session
      }
      try {
        JSON.parse(raw);
      } catch (_) {
        const bak = quarantinePath(fp);
        try {
          fs.renameSync(fp, bak);
          result.quarantined.push(name);
          log('aa-heal', `quarantined corrupt state file ${name} -> ${path.basename(bak)}`);
        } catch (err) {
          log('aa-heal', `quarantine failed for ${name}: ${err.message}`);
        }
      }
    }
  } catch (err) {
    log('aa-heal', `tidyStateDir error: ${err.message}`);
  }
  return result;
}

/**
 * Render a tidy result as a one-block inline announcement, or null if nothing
 * was healed. Kept separate from the pass so tidyStateDir stays pure and
 * unit-testable.
 *
 * @param {{quarantined?: string[], pruned?: string[]}} result
 * @returns {string|null}
 */
function summarizeHeal(result) {
  if (!result) return null;
  const lines = [];
  const q = (result.quarantined || []).length;
  const p = (result.pruned || []).length;
  if (q) {
    lines.push(
      `  🔧 Re-stamped ${q} corrupt session-state file${q === 1 ? '' : 's'} ` +
        `(original saved as .corrupt-*.bak for recovery).`
    );
  }
  if (p) {
    lines.push(`  🧹 Pruned ${p} dead (30d+) session-state orphan${p === 1 ? '' : 's'}.`);
  }
  if (!lines.length) return null;
  return ['🩺 Airport Authority self-heal (own bookkeeping only):', ...lines].join('\n');
}

module.exports = { tidyStateDir, summarizeHeal, quarantinePath };
