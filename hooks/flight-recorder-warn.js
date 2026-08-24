#!/usr/bin/env node
/**
 * Flight Recorder Warn — SessionStart Hook
 *
 * Fires at the start of every session.
 * Checks for a .flight-recorder-warning.json in the current project.
 * If found → injects a context warning so Claude surfaces it immediately.
 * Deletes the warning file after reading (shown once per missed session).
 */

const fs = require('fs');
const path = require('path');

const claudeDir = path.join(process.env.HOME || process.env.USERPROFILE, '.claude');
const logFile = path.join(claudeDir, 'hooks.log');

function log(message) {
  const timestamp = new Date().toISOString();
  fs.appendFileSync(logFile, `${timestamp} [flight-recorder-warn] ${message}\n`);
}

/**
 * Format a relative time string like "3 hours ago", "yesterday", etc.
 */
function relativeTime(isoString) {
  if (!isoString) return 'unknown time';
  const then = new Date(isoString);
  const now = new Date();
  const diffMs = now - then;
  const diffMins = Math.round(diffMs / 60000);
  const diffHours = Math.round(diffMs / 3600000);
  const diffDays = Math.round(diffMs / 86400000);

  if (diffMins < 2) return 'just now';
  if (diffMins < 60) return `${diffMins} minutes ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  if (diffDays === 1) return 'yesterday';
  return `${diffDays} days ago`;
}

/**
 * Resolve the project cwd from the hook payload, surviving malformed JSON
 * (e.g. lone-backslash Windows paths). Candidates are validated against the
 * filesystem; falls back to process.cwd(), which Claude Code sets to the
 * project directory when spawning hooks.
 */
function resolveCwd(rawInput, data) {
  const candidates = [];
  if (data && data.cwd) candidates.push(data.cwd);
  const m = rawInput.match(/"cwd"\s*:\s*"((?:\\.|[^"\\])*)"/);
  if (m) {
    candidates.push(m[1]); // lone-backslash payload: backslashes are already literal
    candidates.push(m[1].replace(/\\\\/g, '\\')); // properly escaped payload
  }
  for (const c of candidates) {
    try {
      if (c && fs.existsSync(c)) return c;
    } catch (e) { /* try next */ }
  }
  return process.cwd();
}

// Read hook input from stdin
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  try {
    let data;
    try {
      data = JSON.parse(input);
    } catch (err) {
      log(`JSON parse error: ${err.message} — raw input (first 300 chars): ${input.slice(0, 300)}`);
      data = {};
    }

    const cwd = resolveCwd(input, data);
    if (!data.cwd) {
      log(`cwd recovered from malformed payload: ${cwd}`);
    }

    const warningPath = path.join(cwd, '.flight-recorder-warning.json');

    if (!fs.existsSync(warningPath)) {
      // No warning — normal startup
      console.log(JSON.stringify({ continue: true, suppressOutput: true }));
      process.exit(0);
    }

    let warning;
    try {
      warning = JSON.parse(fs.readFileSync(warningPath, 'utf8'));
    } catch (err) {
      log(`Could not read warning file: ${err.message}`);
      console.log(JSON.stringify({ continue: true, suppressOutput: true }));
      process.exit(0);
    }

    // Delete warning file — shown once, then gone
    try {
      fs.unlinkSync(warningPath);
      log(`Warning file consumed and deleted`);
    } catch (err) {
      log(`Could not delete warning file: ${err.message}`);
    }

    const missedAgo = relativeTime(warning.missedAt);
    const lastRecordedAgo = relativeTime(warning.recorderLastUpdated);
    const triggerReason = warning.reason === 'clear' ? '/clear' : '/exit';

    const warningMessage = [
      `⚠️  FLIGHT RECORDER: Session ended without /takeoff`,
      ``,
      `You hit ${triggerReason} ${missedAgo} without running /takeoff.`,
      `FLIGHT-RECORDER.md was last updated ${lastRecordedAgo}.`,
      ``,
      `Run /landing to RECOVER that session — it finds what the crashed session`,
      `did, rescues any unsaved deliverables, and rebuilds the missing recorder`,
      `entry from git. (Only use /takeoff instead if you're still IN that session`,
      `with its context intact — from a fresh session, the context is already gone.)`
    ].join('\n');

    log(`Injecting flight recorder warning (missed ${missedAgo})`);

    const response = {
      continue: true,
      suppressOutput: true,
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: `<flight-recorder-warning>\n${warningMessage}\n</flight-recorder-warning>`
      }
    };

    console.log(JSON.stringify(response));
    process.exit(0);

  } catch (err) {
    log(`Unexpected error: ${err.message}`);
    console.log(JSON.stringify({ continue: true, suppressOutput: true }));
    process.exit(0);
  }
});
