#!/usr/bin/env node
/**
 * Airport Authority — flight-status  (SessionStart hook)
 *
 * Merges and replaces the legacy flight-recorder-warn.js. Three jobs:
 *
 *  1. STAMP the session: write {sessionId, startTime, cwd, turns} to the
 *     per-session state file. SessionEnd reads this to decide whether the
 *     recorder was touched THIS session — replacing the old dependency on
 *     a personal, machine-specific time-tracker file that teammates lack
 *     (which made the old warn dead on arrival).
 *
 *  2. CONSUME any .flight-recorder-warning.json left by the previous session's
 *     SessionEnd → surface "you ended without /takeoff" once, then delete it.
 *
 *  3. NUDGE /landing when a FLIGHT-LOG.*.md handoff exists in the project.
 *
 * A hook must never break a session: everything is wrapped, and we always
 * print a valid response and exit 0.
 */

const fs = require('fs');
const path = require('path');
const state = require('./lib/session-state');

function relativeTime(isoString) {
  if (!isoString) return 'unknown time';
  const diffMs = Date.now() - new Date(isoString).getTime();
  const mins = Math.round(diffMs / 60000);
  const hours = Math.round(diffMs / 3600000);
  const days = Math.round(diffMs / 86400000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins} minutes ago`;
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

function emit(context) {
  const response = { continue: true, suppressOutput: true };
  if (context) {
    response.hookSpecificOutput = {
      hookEventName: 'SessionStart',
      additionalContext: context,
    };
  }
  console.log(JSON.stringify(response));
  process.exit(0);
}

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => { input += c; });
process.stdin.on('end', () => {
  try {
    let data;
    try {
      data = JSON.parse(input);
    } catch (err) {
      state.log('flight-status', `JSON parse error: ${err.message}`);
      return emit(null);
    }

    const cwd = data.cwd;
    const sessionId = data.session_id;

    // (1) Stamp the session start — the crux of the dead-warn fix.
    if (sessionId) {
      state.sweepStale();
      state.writeState(sessionId, {
        sessionId,
        cwd: cwd || null,
        startTime: new Date().toISOString(),
        turns: 0,
        checkpointNudgedAtTurn: null,
      });
    }

    if (!cwd) return emit(null);

    const messages = [];

    // (2) Consume a leftover recorder warning (shown once, then deleted).
    try {
      const warningPath = path.join(cwd, '.flight-recorder-warning.json');
      if (fs.existsSync(warningPath)) {
        let warning = {};
        try {
          warning = JSON.parse(fs.readFileSync(warningPath, 'utf8'));
        } catch (err) {
          state.log('flight-status', `could not read warning: ${err.message}`);
        }
        try {
          fs.unlinkSync(warningPath);
        } catch (err) {
          state.log('flight-status', `could not delete warning: ${err.message}`);
        }
        const missedAgo = relativeTime(warning.missedAt);
        const lastRecordedAgo = relativeTime(warning.recorderLastUpdated);
        const trigger = warning.reason === 'clear' ? '/clear' : '/exit';
        messages.push(
          [
            `⚠️  FLIGHT RECORDER: last session ended without /takeoff`,
            ``,
            `You hit ${trigger} ${missedAgo} without running /takeoff.`,
            `FLIGHT-RECORDER.md was last updated ${lastRecordedAgo}.`,
            ``,
            `Run /takeoff now to capture that session before the context is gone,`,
            `or continue if you're fine losing it.`,
          ].join('\n')
        );
      }
    } catch (err) {
      state.log('flight-status', `warning step error: ${err.message}`);
    }

    // (3) Nudge /landing when a handoff exists (FLIGHT-LOG.md or FLIGHT-LOG.<user>.md).
    try {
      const hasHandoff = fs
        .readdirSync(cwd)
        .some((f) => /^FLIGHT-LOG(\..+)?\.md$/i.test(f));
      if (hasHandoff) {
        messages.push(
          [
            `🛬 A FLIGHT-LOG handoff exists in this project.`,
            `Run /landing to restore where you left off before starting new work.`,
          ].join('\n')
        );
      }
    } catch (err) {
      state.log('flight-status', `handoff scan error: ${err.message}`);
    }

    if (messages.length === 0) return emit(null);
    return emit(`<airport-authority-flight-status>\n${messages.join('\n\n')}\n</airport-authority-flight-status>`);
  } catch (err) {
    state.log('flight-status', `unexpected error: ${err.message}`);
    return emit(null);
  }
});
