#!/usr/bin/env node
/**
 * Airport Authority — scheduled fleet sweep  (Flight Ops v1.2, bead A2).
 *
 * The Stop-hook cadence probe (Component 2) only runs DURING a session. This is
 * its out-of-session complement: a headless job the OS scheduler runs on a
 * cadence, so work-at-risk is caught even when no Claude session is open. It
 * scans a set of workspace roots for git repos, runs the same offline health
 * probe on each, and ENQUEUES findings to the shared alert queue — where
 * flight-status.js surfaces them at the next SessionStart and /flight-engineer
 * flushes them to #rf-alerts. It never posts to Slack itself (a scheduled job
 * has no MCP/Slack auth — same reason the hooks only enqueue).
 *
 * Discipline (matches the hooks): OFFLINE only (no fetch/network — probe.js is
 * local git within a time budget), never throws, always exits 0. A scheduled
 * job that errored would just spam the scheduler's failure notifications.
 *
 * Usage:
 *   node scheduled-sweep.js [--dry-run] <root-dir> [<root-dir> ...]
 *     <root-dir>   a workspace root; each git repo directly at it or one level
 *                  under it is swept. Pass several roots to cover more.
 *     --dry-run    report what WOULD enqueue; write nothing.
 *     --help       usage.
 *
 * Scheduling (register it yourself — this script never touches the scheduler):
 *   Windows (Task Scheduler), daily at 09:00:
 *     schtasks /Create /TN "AA Fleet Sweep" /SC DAILY /ST 09:00 ^
 *       /TR "node \"%USERPROFILE%\.claude\plugins\airport-authority\hooks\scheduled-sweep.js\" ~/projects"
 *   macOS (launchd) / Linux (cron): adapt the same command for your platform.
 *     NOTE: macOS support is UNVERIFIED — verify before relying on it.
 */

const fs = require('fs');
const path = require('path');
const probe = require('./lib/probe');
const alert = require('./lib/alert');
const { log } = require('./lib/session-state');

// A scheduled sweep should stay bounded no matter how sprawling the workspace.
const MAX_REPOS = 200;

function isDir(p) {
  try { return fs.statSync(p).isDirectory(); } catch (_) { return false; }
}

// `.git` is a dir in a normal clone and a FILE in a worktree/submodule — either
// counts. existsSync covers both.
function isRepo(dir) {
  try { return fs.existsSync(path.join(dir, '.git')); } catch (_) { return false; }
}

/** Repos found AT each root or one level under it (deduped, absolute). */
function discoverRepos(roots) {
  const repos = new Set();
  for (const root of roots) {
    if (!isDir(root)) continue;
    const abs = path.resolve(root);
    if (isRepo(abs)) repos.add(abs);
    let names = [];
    try { names = fs.readdirSync(abs); } catch (_) { continue; }
    for (const name of names) {
      const child = path.join(abs, name);
      if (isDir(child) && isRepo(child)) repos.add(path.resolve(child));
    }
  }
  return [...repos];
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write(
      'Usage: node scheduled-sweep.js [--dry-run] <root-dir> [<root-dir> ...]\n' +
      '  Sweeps git repos at/under each root for work-at-risk and enqueues alerts.\n'
    );
    return 0;
  }
  const dryRun = argv.includes('--dry-run');
  const roots = argv.filter((a) => !a.startsWith('-'));

  if (roots.length === 0) {
    process.stdout.write('scheduled-sweep: no workspace roots given — nothing to do.\n');
    return 0; // a misconfigured schedule must not look like a failure
  }

  const found = discoverRepos(roots);
  const repos = found.slice(0, MAX_REPOS);
  if (found.length > repos.length) {
    // Never cap silently — say what was dropped.
    log('aa-sweep', `capped at ${MAX_REPOS} repos (found ${found.length}); ${found.length - repos.length} not swept this run`);
  }

  let findingCount = 0;
  let flaggedRepos = 0;
  for (const repo of repos) {
    let findings = [];
    try { findings = probe.healthProbe(repo) || []; } catch (_) { findings = []; }
    if (!findings.length) continue;
    flaggedRepos += 1;
    for (const f of findings) {
      findingCount += 1;
      if (dryRun) continue;
      // detail tags the source so the dedupKey is stable across scheduled runs
      // and coalesces with the same condition seen by the in-session probe.
      alert.enqueue({ ...f, detail: f.dedupKey || f.kind });
    }
  }

  const verb = dryRun ? 'would enqueue' : 'enqueued';
  process.stdout.write(
    `scheduled-sweep: scanned ${repos.length} repo(s)` +
    (found.length > repos.length ? ` (of ${found.length}; capped at ${MAX_REPOS})` : '') +
    `, ${flaggedRepos} with issues, ${verb} ${findingCount} finding(s).\n`
  );
  return 0;
}

module.exports = { discoverRepos, isRepo, main };

// Only run the sweep when invoked directly (`node scheduled-sweep.js …`), not
// when required (e.g. by the test suite). Never let a scheduled job
// crash-report: swallow anything and exit 0.
if (require.main === module) {
  try {
    process.exit(main());
  } catch (err) {
    try { log('aa-sweep', `unexpected error: ${err.message}`); } catch (_) { /* ignore */ }
    process.exit(0);
  }
}
