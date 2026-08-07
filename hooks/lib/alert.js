/**
 * Airport Authority — shared alert queue  (Flight Ops, v1.1).
 *
 * Hooks and skills detect failures — durable-write failure, Tome drift,
 * uncommitted pileup, failing CI — and ENQUEUE them here. Enqueue is a pure
 * local append: NEVER a network call. That's the load-bearing design choice —
 * a hook runs headless with a ~10s budget and may have no MCP/Slack auth, so
 * it must not try to post to Slack itself (the alert would just be lost).
 *
 * Two consumers drain the queue, both where they can succeed:
 *   1. flight-status.js (SessionStart) surfaces UNSENT alerts inline in the
 *      session context — always works, no network. This is the guaranteed
 *      path: even fully offline, you still see what bit you.
 *   2. The flight-engineer skill (Claude-driven, where mcpl/Slack auth exists)
 *      flushes unsent alerts to #rf-alerts via mcpl and calls markSent().
 *
 * Location: user-global (same rationale as session-state.js — a marketplace
 * plugin dir may be read-only; and a single queue aggregates alerts across
 * projects into one #rf-alerts digest). It's an append log; each entry carries
 * its own cwd/project/session context.
 *
 * Every function is failure-tolerant: an alert must NEVER crash a hook, so
 * these swallow errors and return safe defaults rather than throwing.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { log } = require('./session-state');

const HOME = process.env.HOME || process.env.USERPROFILE || os.homedir();
const AA_DIR = path.join(HOME, '.claude', 'airport-authority');
const ALERTS_FILE = path.join(AA_DIR, 'alerts.json');

// Drop sent alerts older than this so the queue stays bounded. Unsent alerts
// are NEVER auto-pruned — an un-surfaced failure should not silently expire.
const SENT_RETENTION_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

// Severity aligns with flight-engineer's plain-language scale.
const SEVERITY = { RED: 'red', YELLOW: 'yellow' };

let idCounter = 0;
function nextId() {
  idCounter += 1;
  return `${Date.now()}-${process.pid}-${idCounter}`;
}

function ensureDir() {
  try {
    fs.mkdirSync(AA_DIR, { recursive: true });
    return true;
  } catch (_) {
    return false;
  }
}

const LOCK_DIR = path.join(AA_DIR, 'alerts.lock');
const LOCK_STALE_MS = 5000;

function sleepMs(ms) {
  // Synchronous, CPU-friendly pause (no busy-spin). Available on Node's main
  // thread; degrades to a no-op if SharedArrayBuffer is unavailable.
  try {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  } catch (_) {
    /* no-op */
  }
}

/**
 * Best-effort cross-process mutex around a read-modify-write of the queue file,
 * via atomic `mkdir` (fails if the dir exists). Two hooks in two sessions can
 * otherwise both read alerts.json, then last-writer-wins drops one alert.
 *
 * It NEVER wedges a hook: after a bounded (~1s) wait it steals a *stale* lock
 * (holder crashed) or proceeds unlocked — degrading to the prior last-writer
 * behavior rather than hanging a session. An advisory alert must not cost a
 * session its startup.
 */
function withLock(fn) {
  ensureDir();
  const deadline = Date.now() + 1000;
  while (Date.now() < deadline) {
    try {
      fs.mkdirSync(LOCK_DIR);
    } catch (err) {
      if (err.code !== 'EEXIST') return fn(); // unexpected FS error — don't hang
      try {
        const age = Date.now() - fs.statSync(LOCK_DIR).mtimeMs;
        if (age > LOCK_STALE_MS) {
          fs.rmdirSync(LOCK_DIR); // steal a stale lock; re-contend next loop
          continue;
        }
      } catch (_) {
        /* lock vanished between stat and now — just retry */
      }
      sleepMs(15);
      continue;
    }
    try {
      return fn();
    } finally {
      try {
        fs.rmdirSync(LOCK_DIR);
      } catch (_) {
        /* already released/stolen */
      }
    }
  }
  return fn(); // couldn't acquire in time — proceed unlocked rather than lose it
}

function readAll() {
  try {
    if (!fs.existsSync(ALERTS_FILE)) return [];
    const parsed = JSON.parse(fs.readFileSync(ALERTS_FILE, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    // A corrupt queue must not wedge the suite — log and start clean.
    log('aa-alert', `readAll error (resetting): ${err.message}`);
    return [];
  }
}

function writeAll(alerts) {
  if (!ensureDir()) return false;
  try {
    const tmp = `${ALERTS_FILE}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(alerts, null, 2));
    fs.renameSync(tmp, ALERTS_FILE); // torn-write-safe
    return true;
  } catch (err) {
    log('aa-alert', `writeAll error: ${err.message}`);
    return false;
  }
}

/**
 * A stable key for de-duping repeat firings of the SAME condition. Two hooks
 * flagging "uncommitted pileup in repo X" across turns should coalesce into one
 * unsent alert (with a bumped count), not spam the channel.
 */
function dedupKeyOf(alert) {
  if (alert.dedupKey) return alert.dedupKey;
  return `${alert.kind || 'unknown'}:${alert.cwd || ''}:${alert.detail || ''}`;
}

/**
 * Enqueue an alert. Coalesces with an existing UNSENT alert of the same
 * dedupKey (bumps count + lastTs) instead of appending a duplicate. Prunes old
 * sent alerts opportunistically. Returns true if the queue was updated.
 *
 * @param {object} alert
 * @param {string} alert.kind      machine-readable category (e.g. 'ci-failure')
 * @param {string} alert.message   plain-language, non-engineer-friendly line
 * @param {string} [alert.severity] SEVERITY.RED (default) | SEVERITY.YELLOW
 * @param {string} [alert.cwd]     project path (defaults from context)
 * @param {string} [alert.project] short project label
 * @param {string} [alert.sessionId]
 * @param {string} [alert.detail]  extra dedup discriminator
 * @param {string} [alert.dedupKey] explicit override
 */
function enqueue(alert) {
  try {
    if (!alert || !alert.kind || !alert.message) {
      log('aa-alert', 'enqueue skipped: missing kind/message');
      return false;
    }
    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const cwd = alert.cwd || process.cwd();
    const key = dedupKeyOf({ ...alert, cwd });

    // Lock the whole read-modify-write so a concurrent enqueue in another
    // session can't read a stale copy and clobber this alert on write-back.
    return withLock(() => {
      let alerts = readAll();

      // Prune stale SENT entries only (never drop unsent).
      alerts = alerts.filter(
        (a) => !a.sent || !a.sentAt || now - new Date(a.sentAt).getTime() < SENT_RETENTION_MS
      );

      const existing = alerts.find((a) => !a.sent && dedupKeyOf(a) === key);
      if (existing) {
        existing.count = (existing.count || 1) + 1;
        existing.lastTs = nowIso;
        existing.message = alert.message; // keep the freshest phrasing
        return writeAll(alerts); // propagate write failure, don't fake success
      }

      alerts.push({
        id: nextId(),
        ts: nowIso,
        lastTs: nowIso,
        count: 1,
        severity: alert.severity || SEVERITY.RED,
        kind: alert.kind,
        message: alert.message,
        cwd,
        project: alert.project || path.basename(cwd || '') || null,
        sessionId: alert.sessionId || null,
        detail: alert.detail || null,
        dedupKey: key,
        sent: false,
      });
      return writeAll(alerts);
    });
  } catch (err) {
    log('aa-alert', `enqueue error: ${err.message}`);
    return false;
  }
}

/** All unsent alerts, newest firing first. */
function unsent() {
  return readAll()
    .filter((a) => !a.sent)
    .sort((a, b) => new Date(b.lastTs || b.ts) - new Date(a.lastTs || a.ts));
}

/**
 * Mark alerts as sent (called by the flight-engineer flush after a successful
 * post). Each entry is either:
 *   - a bare string `id` → mark unconditionally (used by `--all` / legacy), or
 *   - `{ id, lastTs }`   → mark ONLY if the alert's current `lastTs` still
 *     matches. This is the dedup-safe guard: if the same condition re-fired
 *     between `digest` and this call, `enqueue()` coalesced into the same id
 *     and bumped `lastTs`/`count` — that new firing was never posted, so we
 *     leave it unsent and it re-surfaces on the next flush instead of being
 *     silently swallowed.
 */
function markSent(entries) {
  try {
    const list = Array.isArray(entries) ? entries : [entries];
    const guards = new Map(); // id -> expected lastTs (or null = unconditional)
    for (const e of list) {
      if (typeof e === 'string') guards.set(e, null);
      else if (e && e.id) guards.set(e.id, e.lastTs || null);
    }
    if (guards.size === 0) return false;
    return withLock(() => {
      const sentAt = new Date().toISOString();
      const alerts = readAll();
      let changed = false;
      for (const a of alerts) {
        if (!guards.has(a.id) || a.sent) continue;
        const expected = guards.get(a.id);
        if (expected && a.lastTs !== expected) continue; // re-fired since digest
        a.sent = true;
        a.sentAt = sentAt;
        changed = true;
      }
      return changed ? writeAll(alerts) : false;
    });
  } catch (err) {
    log('aa-alert', `markSent error: ${err.message}`);
    return false;
  }
}

const SEV_ICON = { red: '🔴', yellow: '🟡' };

/**
 * Render unsent alerts as a plain-language block for the SessionStart surface.
 * Returns '' when there's nothing to show.
 */
function summarizeForInline(alerts) {
  const list = alerts || unsent();
  if (!list.length) return '';
  const lines = list.map((a) => {
    const icon = SEV_ICON[a.severity] || '🔴';
    const proj = a.project ? ` [${a.project}]` : '';
    const times = a.count > 1 ? ` (×${a.count})` : '';
    return `  ${icon}${proj} ${a.message}${times}`;
  });
  return [
    `⚠️  FLIGHT OPS: ${list.length} unresolved alert${list.length !== 1 ? 's' : ''} since last check`,
    ...lines,
    ``,
    `Run /flight-engineer to review and clear these (it posts them to #rf-alerts).`,
  ].join('\n');
}

module.exports = {
  ALERTS_FILE,
  SEVERITY,
  enqueue,
  readAll,
  unsent,
  markSent,
  summarizeForInline,
  dedupKeyOf,
};
