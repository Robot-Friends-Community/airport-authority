#!/usr/bin/env node
/**
 * Airport Authority — uninstall / cleanup helper  (v1.2, bead C3).
 *
 * `/plugin uninstall airport-authority` removes the plugin's code and hooks, but
 * it leaves AA's user-global footprint behind: per-session state, the alert
 * queue, and event-claim files under ~/.claude/airport-authority/. This helper
 * reports that footprint and, with --purge, removes AA's OWN directory —
 * nothing else. It never touches the repo, the plugin install, or any path
 * outside ~/.claude/airport-authority/.
 *
 * It also detects LEGACY hand-placed hook copies (from the old install.sh, which
 * copied hooks into ~/.claude/hooks/) so a user migrating to the plugin can
 * remove them and stop the double-fire at the source.
 *
 * Usage:
 *   node uninstall.js            # report the footprint + how to fully uninstall
 *   node uninstall.js --purge    # ALSO delete ~/.claude/airport-authority/
 *
 * Never throws; always exits 0.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const HOME = process.env.HOME || process.env.USERPROFILE || os.homedir();
const AA_DIR = path.join(HOME, '.claude', 'airport-authority');
const LEGACY_HOOKS_DIR = path.join(HOME, '.claude', 'hooks');
// The hook scripts the legacy install.sh copied into ~/.claude/hooks/.
const LEGACY_HOOK_FILES = [
  'flight-status.js',
  'flight-recorder-check.js',
  'flight-recorder-warn.js',
  'session-start.js',
  'checkpoint-nudge.js',
  'precompact-nudge.js',
];

/** Count files and total bytes under a dir (recursive). Never throws. */
function footprint(dir) {
  let files = 0;
  let bytes = 0;
  const walk = (d) => {
    let entries = [];
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch (_) { return; }
    for (const e of entries) {
      const fp = path.join(d, e.name);
      if (e.isDirectory()) walk(fp);
      else {
        files += 1;
        try { bytes += fs.statSync(fp).size; } catch (_) { /* ignore */ }
      }
    }
  };
  if (fs.existsSync(dir)) walk(dir);
  return { files, bytes };
}

/** Legacy hook scripts present in ~/.claude/hooks/. */
function legacyHooksPresent() {
  const found = [];
  for (const name of LEGACY_HOOK_FILES) {
    const fp = path.join(LEGACY_HOOKS_DIR, name);
    try { if (fs.existsSync(fp)) found.push(name); } catch (_) { /* ignore */ }
  }
  return found;
}

/** Remove ONLY AA's own user-global dir. Returns true if it was removed. */
function purge() {
  try {
    if (!fs.existsSync(AA_DIR)) return false;
    fs.rmSync(AA_DIR, { recursive: true, force: true });
    return true;
  } catch (_) {
    return false;
  }
}

function report(out) {
  const fp = footprint(AA_DIR);
  const legacy = legacyHooksPresent();
  const lines = [
    'Airport Authority — uninstall / cleanup',
    '',
    `  State dir: ${AA_DIR}`,
    fs.existsSync(AA_DIR)
      ? `    ${fp.files} file(s), ${(fp.bytes / 1024).toFixed(1)} KB (session state, alert queue, event claims)`
      : '    (none — nothing to clean)',
    '',
    'To fully remove Airport Authority:',
    '  1. /plugin uninstall airport-authority   (removes the plugin code + hooks)',
    legacy.length
      ? `  2. Remove legacy hand-placed hooks in ${LEGACY_HOOKS_DIR}: ${legacy.join(', ')}`
      : '  2. (no legacy hand-placed hooks detected)',
    '  3. node uninstall.js --purge             (clears the state dir above)',
    '',
    'To roll back instead of uninstall: reinstall a prior version from the',
    'marketplace, e.g. /plugin install airport-authority@1.1.0',
  ];
  out(lines.join('\n') + '\n');
  return { footprint: fp, legacy };
}

function main() {
  const purgeMode = process.argv.includes('--purge');
  report((s) => process.stdout.write(s));
  if (purgeMode) {
    const removed = purge();
    process.stdout.write(removed ? 'Purged the state dir.\n' : 'Nothing to purge.\n');
  }
  return 0;
}

module.exports = { footprint, legacyHooksPresent, purge, report, AA_DIR };

// Only run when invoked directly — requiring it in tests must not delete anything.
if (require.main === module) {
  try {
    process.exit(main());
  } catch (_) {
    process.exit(0);
  }
}
