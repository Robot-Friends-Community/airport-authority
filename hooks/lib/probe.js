/**
 * Airport Authority — proactive health probe  (Flight Ops, v1.1 Component 2).
 *
 * A LIGHTWEIGHT, hook-safe subset of the flight-engineer sweep that the Stop
 * hook can run itself, headless, every Nth turn — so work-at-risk surfaces
 * DURING a long session instead of only when the user remembers to run
 * /flight-engineer or starts a fresh one.
 *
 * Hard constraints (this runs in a Stop hook after every turn):
 *   - NEVER throws — a probe must not crash or wedge a session.
 *   - OFFLINE only — no `git fetch`, no network. Every git call is local, and
 *     bounded by a short timeout; on any failure the check is simply skipped.
 *   - Cheap — only runs on the cadence the caller enforces, and returns fast.
 *
 * It DETECTS and returns findings; it does NOT enqueue or surface. The caller
 * (checkpoint-nudge.js) wires findings into the alert queue + inline surface,
 * keeping this module pure and unit-testable.
 */

const path = require('path');
const { execFileSync } = require('child_process');
const { log } = require('./session-state');

// Tunable thresholds. Deliberately not aggressive — a low bar would nag.
const UNCOMMITTED_THRESHOLD = 12; // changed files before "pileup"
const UNPUSHED_THRESHOLD = 6; // local commits ahead of upstream before "not backed up"

// Branch names we treat as "protected" — uncommitted work on one of these is a
// smell (the house rule is to branch first, never build straight on main).
const PROTECTED_BRANCHES = new Set(['main', 'master', 'trunk']);

// Latency guards for a Stop hook (fires every turn — it must never stall).
// Local git is milliseconds when healthy; a call that blows the per-command cap
// is a slow/locked repo or AV interference and we WANT to bail rather than wait.
// The overall budget bounds the TOTAL time across all probe git calls, so worst
// case is ~PROBE_BUDGET_MS, not (per-command timeout × number of calls).
const GIT_TIMEOUT_MS = 500; // per-command cap
const PROBE_BUDGET_MS = 1200; // total budget across the whole probe

/**
 * Run a local git command within the remaining probe budget. Returns trimmed
 * stdout, or null on ANY failure — including "already out of budget", so later
 * checks self-skip once the deadline passes.
 */
function git(args, cwd, deadline) {
  const remaining = deadline - Date.now();
  if (remaining <= 0) return null; // budget spent — skip the rest of the probe
  try {
    return execFileSync('git', args, {
      cwd,
      timeout: Math.min(GIT_TIMEOUT_MS, remaining),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'], // no stderr noise; no inherited stdin
      windowsHide: true,
    }).trim();
  } catch (_) {
    // not a repo · git missing · timeout · no upstream — all "unknown", skip
    return null;
  }
}

/**
 * Probe the given working directory for work-at-risk. Returns an array of
 * alert-shaped findings (possibly empty). Never throws.
 *
 * @param {string} cwd  the session's working directory
 * @returns {Array<{kind,severity,message,cwd,project,dedupKey}>}
 */
function healthProbe(cwd) {
  const findings = [];
  try {
    if (!cwd) return findings;

    const deadline = Date.now() + PROBE_BUDGET_MS;

    // Gate on being inside a git work tree — cheapest possible check first.
    if (git(['rev-parse', '--is-inside-work-tree'], cwd, deadline) !== 'true') return findings;

    const project = path.basename(cwd) || null;

    // Current branch, or 'HEAD' when detached. Cheap; drives the branch checks.
    const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'], cwd, deadline);

    // Uncommitted work — measured once, reused by the checks below.
    const status = git(['status', '--porcelain'], cwd, deadline);
    const changed = status ? status.split('\n').filter(Boolean).length : 0;

    // 1) Uncommitted pileup — a growing body of unsaved work (crash = lost).
    if (status !== null && changed >= UNCOMMITTED_THRESHOLD) {
      findings.push({
        kind: 'uncommitted-pileup',
        severity: 'yellow',
        message: `${changed} uncommitted files piling up — work not backed up (commit soon)`,
        cwd,
        project,
        dedupKey: `uncommitted-pileup:${cwd}`,
      });
    }

    // 1b) Uncommitted work on a protected branch — the house rule is to branch
    // first, never build straight on main. (v1.2 A3)
    if (status !== null && changed > 0 && branch && PROTECTED_BRANCHES.has(branch)) {
      findings.push({
        kind: 'on-main-dirty',
        severity: 'yellow',
        message: `uncommitted work on '${branch}' — move it to a feature branch (don't build on ${branch})`,
        cwd,
        project,
        dedupKey: `on-main-dirty:${cwd}`,
      });
    }

    // 1c) Detached HEAD with uncommitted work — commits made here aren't on any
    // branch and are easy to lose. (v1.2 A3) Gated on work-at-stake so a plain
    // rebase/bisect checkout doesn't nag.
    if (status !== null && changed > 0 && branch === 'HEAD') {
      findings.push({
        kind: 'detached-head',
        severity: 'yellow',
        message: `detached HEAD with uncommitted changes — you're not on a branch (commits here can be lost)`,
        cwd,
        project,
        dedupKey: `detached-head:${cwd}`,
      });
    }

    // 2) Unpushed commits — committed but not backed up off-machine. Offline:
    // compare to the TRACKED upstream, never fetch. No upstream → skip silently.
    const upstream = git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], cwd, deadline);
    if (upstream) {
      const ahead = git(['rev-list', '--count', '@{u}..HEAD'], cwd, deadline);
      const n = ahead ? parseInt(ahead, 10) : 0;
      if (Number.isFinite(n) && n >= UNPUSHED_THRESHOLD) {
        findings.push({
          kind: 'unpushed-commits',
          severity: 'yellow',
          message: `${n} commits not pushed — not backed up off-machine (push soon)`,
          cwd,
          project,
          dedupKey: `unpushed-commits:${cwd}`,
        });
      }
    }
  } catch (err) {
    log('aa-probe', `healthProbe error: ${err.message}`);
  }
  return findings;
}

module.exports = {
  healthProbe,
  UNCOMMITTED_THRESHOLD,
  UNPUSHED_THRESHOLD,
  PROTECTED_BRANCHES,
  GIT_TIMEOUT_MS,
};
