#!/usr/bin/env node
/**
 * Airport Authority — alert CLI  (Flight Ops, v1.1).
 *
 * A thin, stable command-line face over lib/alert.js so the flight-engineer
 * SKILL (Claude-driven markdown — it can't require() a plugin-relative module
 * reliably across the canonical/mirror split) can drive the alert queue:
 *
 *   node alert-cli.js enqueue --kind ci-failure --severity red \
 *        --message "CI failing on PR #12 (build)" --project your-team-library
 *   node alert-cli.js digest        # -> { text, ids, tokens } : Slack-ready + guard tokens
 *   node alert-cli.js unsent        # -> raw JSON array of unsent alerts
 *   node alert-cli.js mark-sent <token> [<token>...]   (or: mark-sent --all)
 *
 * The `digest` + `mark-sent <tokens>` split is dedup-safe: each token is
 * `id@lastTs`, and mark-sent only clears an alert whose lastTs still matches.
 * A brand-new alert that arrives between the two steps has an id the digest
 * never listed; a RE-FIRE of an already-digested alert coalesces into the same
 * id but bumps lastTs, so its token no longer matches — either way the
 * un-posted firing stays queued and surfaces on the next flush, never silently
 * swallowed.
 *
 * Like alert.js, this never throws for operational reasons: it prints a result
 * and exits 0 on success, exits 1 only on genuinely unusable input.
 */

const path = require('path');
const alert = require('./alert');

const CHANNEL = '#rf-alerts (C0AV5A76HFC)';

/**
 * Parse flags into an object. Supports `--flag value`, bare `--flag` (boolean),
 * and `--flag=value`. The `=` form is the escape hatch for a value that itself
 * starts with `--` (e.g. `--message="--build failed"`), which the space form
 * would otherwise mis-read as the next flag.
 */
function parseFlags(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const tok = argv[i];
    if (!tok.startsWith('--')) continue;
    const eq = tok.indexOf('=');
    if (eq !== -1) {
      out[tok.slice(2, eq)] = tok.slice(eq + 1);
      continue;
    }
    const key = tok.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      out[key] = true;
    } else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}

/** Version-guard token for mark-sent: id + the lastTs seen at digest time. */
function tokenOf(a) {
  return `${a.id}@${a.lastTs || a.ts}`;
}

const SEV_ICON = { red: '🔴', yellow: '🟡' };

/**
 * Render the unsent queue as a #rf-alerts-ready message plus the exact ids it
 * covers. One message aggregates alerts across all projects (the queue is
 * user-global), grouped by project for scannability.
 */
function buildDigest() {
  const list = alert.unsent();
  const ids = list.map((a) => a.id);
  if (!list.length) return { text: '', ids: [], tokens: [] };

  const byProject = new Map();
  for (const a of list) {
    const key = a.project || 'unknown';
    if (!byProject.has(key)) byProject.set(key, []);
    byProject.get(key).push(a);
  }

  const lines = [
    `:rotating_light: *Flight Ops — ${list.length} unresolved alert${list.length !== 1 ? 's' : ''}*`,
    '',
  ];
  for (const [proj, alerts] of byProject) {
    lines.push(`*${proj}*`);
    for (const a of alerts) {
      const icon = SEV_ICON[a.severity] || '🔴';
      const times = a.count > 1 ? ` (×${a.count})` : '';
      lines.push(`  ${icon} ${a.message}${times}`);
    }
    lines.push('');
  }
  lines.push('_Posted by /flight-engineer. Merges & deploys still stay human._');
  // `tokens` carry each id's lastTs so mark-sent only clears what was actually
  // posted — a re-fire between digest and mark-sent bumps lastTs and is skipped.
  return { text: lines.join('\n').trimEnd(), ids, tokens: list.map(tokenOf) };
}

function main() {
  const [cmd, ...rest] = process.argv.slice(2);

  switch (cmd) {
    case 'enqueue': {
      const f = parseFlags(rest);
      if (typeof f.kind !== 'string' || typeof f.message !== 'string') {
        process.stderr.write(
          'enqueue requires --kind and --message with string values ' +
            '(use --flag=value if a value starts with "--")\n'
        );
        process.exit(1);
      }
      const sev =
        f.severity === 'yellow'
          ? alert.SEVERITY.YELLOW
          : f.severity === 'red'
          ? alert.SEVERITY.RED
          : undefined;
      const ok = alert.enqueue({
        kind: f.kind,
        message: f.message,
        severity: sev,
        cwd: typeof f.cwd === 'string' ? f.cwd : undefined,
        project: typeof f.project === 'string' ? f.project : undefined,
        detail: typeof f.detail === 'string' ? f.detail : undefined,
        dedupKey: typeof f.dedupKey === 'string' ? f.dedupKey : undefined,
      });
      process.stdout.write(JSON.stringify({ enqueued: ok }) + '\n');
      return;
    }

    case 'unsent': {
      process.stdout.write(JSON.stringify(alert.unsent(), null, 2) + '\n');
      return;
    }

    case 'digest': {
      const { text, ids, tokens } = buildDigest();
      // Pass `tokens` (not `ids`) to `mark-sent` for the dedup-safe guard;
      // `ids` stays for display/back-compat.
      process.stdout.write(
        JSON.stringify({ channel: CHANNEL, text, ids, tokens }, null, 2) + '\n'
      );
      return;
    }

    case 'mark-sent': {
      const f = parseFlags(rest);
      // `--all` marks every unsent alert unconditionally. Otherwise each arg is
      // a token: `id@lastTs` → version-guarded (from digest), bare `id` → plain.
      const entries = f.all
        ? alert.unsent().map((a) => a.id)
        : rest
            .filter((t) => !t.startsWith('--'))
            .map((t) => {
              const at = t.indexOf('@');
              return at === -1 ? t : { id: t.slice(0, at), lastTs: t.slice(at + 1) };
            });
      if (!entries.length) {
        process.stdout.write(JSON.stringify({ marked: false, count: 0 }) + '\n');
        return;
      }
      const ok = alert.markSent(entries);
      process.stdout.write(JSON.stringify({ marked: ok, count: entries.length }) + '\n');
      return;
    }

    default:
      process.stderr.write(
        [
          'Airport Authority alert CLI — usage:',
          '  enqueue --kind K --message M [--severity red|yellow] [--project P] [--cwd C] [--detail D]',
          '  digest                 # { channel, text, ids, tokens } — post text, then mark-sent the tokens',
          '  unsent                 # raw JSON of unsent alerts',
          '  mark-sent <token>...   # tokens from digest (id@lastTs, dedup-safe) — or --all',
          '',
          `Flush target: ${CHANNEL}`,
        ].join('\n') + '\n'
      );
      process.exit(cmd ? 1 : 0);
  }
}

main();
