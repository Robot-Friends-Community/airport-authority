/**
 * Airport Authority — shared session-state helper.
 *
 * All four Airport Authority hooks coordinate through one small per-session
 * state file so the suite is SELF-CONTAINED (no dependency on a personal,
 * machine-specific time-tracker that teammates don't have — that was the old
 * "dead-on-arrival warning" bug).
 *
 * Location decision (Codex-flagged): user-global, NOT ${CLAUDE_PLUGIN_ROOT}.
 *   ~/.claude/airport-authority/state/<session_id>.json
 * Rationale:
 *   - Marketplace-installed plugin dirs may be read-only → can't write there.
 *   - Keyed by session_id (Claude passes it to every hook) → two concurrent
 *     sessions in the SAME repo each get their own file, never clobbering.
 *     This is the durable per-session suppression key the Stop hook needs.
 *   - Doesn't pollute project folders.
 *
 * Every function is failure-tolerant: a hook must NEVER crash a session, so
 * these swallow errors and return safe defaults rather than throwing.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const HOME = process.env.HOME || process.env.USERPROFILE || os.homedir();
const STATE_DIR = path.join(HOME, '.claude', 'airport-authority', 'state');
const LOG_FILE = path.join(HOME, '.claude', 'hooks.log');

// 30 days: generous enough that a long-idle-but-live session's state won't be
// swept out from under it by a later session's SessionStart (Codex review, low).
const STALE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function log(tag, message) {
  try {
    fs.appendFileSync(LOG_FILE, `${new Date().toISOString()} [${tag}] ${message}\n`);
  } catch (_) {
    /* logging must never break a hook */
  }
}

function ensureDir() {
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    return true;
  } catch (_) {
    return false;
  }
}

function statePath(sessionId) {
  // session_id comes straight from Claude; sanitize defensively for a filename.
  const safe = String(sessionId || 'unknown').replace(/[^A-Za-z0-9_-]/g, '_');
  return path.join(STATE_DIR, `${safe}.json`);
}

function claimsPath(sessionId) {
  const safe = String(sessionId || 'unknown').replace(/[^A-Za-z0-9_-]/g, '_');
  return path.join(STATE_DIR, `${safe}.claims.json`);
}

/**
 * Single-owner guard against duplicate hook firings.
 *
 * When a teammate has BOTH the legacy hand-placed hooks (copied into ~/.claude
 * by install.sh) AND the airport-authority plugin installed, Claude invokes two
 * copies of the SAME hook for one event, back to back. This would double-count
 * turns, double-stamp state, and print every SessionStart nudge twice.
 *
 * The two copies share this state dir, so the first to run "claims" the event
 * for a short window; a sibling copy that finds a fresh claim bows out. Kept in
 * a SEPARATE tiny file (not the session state) so it never disturbs the state
 * skeleton. Real successive events — session starts, user turns — are seconds
 * apart, far outside the window, so a genuine event is never suppressed.
 *
 * @returns {boolean} true if THIS invocation should proceed; false if a sibling
 *   copy just handled the same event.
 */
function claimEvent(sessionId, event, windowMs) {
  if (!sessionId || !event) return true; // can't dedupe without keys — don't block a hook
  try {
    if (!ensureDir()) return true;
    const p = claimsPath(sessionId);
    let claims = {};
    try {
      if (fs.existsSync(p)) {
        const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (parsed && typeof parsed === 'object') claims = parsed;
      }
    } catch (_) {
      claims = {}; // corrupt claims file — start clean, never block on it
    }
    const now = Date.now();
    const last = claims[event];
    if (typeof last === 'number' && now - last < windowMs) return false; // sibling handled it
    claims[event] = now;
    const tmp = `${p}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(claims));
    fs.renameSync(tmp, p); // torn-write-safe
    return true;
  } catch (_) {
    return true; // a dedupe failure must never cost a hook its run
  }
}

function readState(sessionId) {
  if (!sessionId) return null;
  try {
    const p = statePath(sessionId);
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (err) {
    log('aa-state', `readState error: ${err.message}`);
    return null;
  }
}

function writeState(sessionId, state) {
  if (!sessionId) return false;
  if (!ensureDir()) return false;
  try {
    const p = statePath(sessionId);
    // write-to-temp + rename for a torn-write-safe update
    const tmp = `${p}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
    fs.renameSync(tmp, p);
    return true;
  } catch (err) {
    log('aa-state', `writeState error: ${err.message}`);
    return false;
  }
}

function deleteState(sessionId) {
  if (!sessionId) return;
  try {
    const p = statePath(sessionId);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } catch (err) {
    log('aa-state', `deleteState error: ${err.message}`);
  }
}

/**
 * Remove orphaned state files from sessions that never reached SessionEnd
 * (crash, force-quit, etc.). Called cheaply from SessionStart.
 */
function sweepStale(maxAgeMs = STALE_MAX_AGE_MS) {
  try {
    if (!fs.existsSync(STATE_DIR)) return;
    const now = Date.now();
    for (const name of fs.readdirSync(STATE_DIR)) {
      if (!name.endsWith('.json')) continue;
      const fp = path.join(STATE_DIR, name);
      try {
        if (now - fs.statSync(fp).mtimeMs > maxAgeMs) fs.unlinkSync(fp);
      } catch (_) {
        /* ignore a single file we can't stat/remove */
      }
    }
  } catch (err) {
    log('aa-state', `sweepStale error: ${err.message}`);
  }
}

module.exports = {
  STATE_DIR,
  STALE_MAX_AGE_MS,
  log,
  statePath,
  claimsPath,
  claimEvent,
  readState,
  writeState,
  deleteState,
  sweepStale,
};
