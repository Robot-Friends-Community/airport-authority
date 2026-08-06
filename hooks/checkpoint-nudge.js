#!/usr/bin/env node
/**
 * Airport Authority — checkpoint-nudge  (Stop hook)
 *
 * Fires each time Claude finishes responding (one assistant turn). We count
 * turns in the per-session state file and, once past a heuristic threshold,
 * nudge ONCE to /takeoff + /clear so the user stays in the "fresh context"
 * zone before quality degrades.
 *
 * Why a turn count? VERIFIED (via claude-code-guide) that NO hook exposes
 * context %/token usage and there's no context-threshold event — so a
 * turn-count proxy is the best available signal for "you're getting deep."
 *
 * Idempotency / no-nag: the nudge is gated by checkpointNudgedAtTurn in the
 * state file, so even if the hook double-fires (e.g. a teammate has both the
 * legacy skill and this plugin installed) it surfaces at most once per session.
 *
 * Never breaks a session: wrapped, always exits 0 with a valid response.
 */

const state = require('./lib/session-state');

// Heuristic proxy for "~half the context used." Tunable; deliberately not
// aggressive — nagging early would train users to ignore it.
const CHECKPOINT_TURN_THRESHOLD = 25;

function emit(context) {
  const response = { continue: true, suppressOutput: true };
  if (context) {
    response.hookSpecificOutput = {
      hookEventName: 'Stop',
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
    let data = {};
    try {
      data = JSON.parse(input);
    } catch (err) {
      state.log('checkpoint-nudge', `JSON parse error: ${err.message}`);
      return emit(null);
    }

    const sessionId = data.session_id;
    if (!sessionId) return emit(null);

    // Read (or lazily initialize) this session's state.
    let s = state.readState(sessionId);
    if (!s) {
      s = {
        sessionId,
        cwd: data.cwd || null,
        startTime: new Date().toISOString(),
        turns: 0,
        checkpointNudgedAtTurn: null,
      };
    }

    s.turns = (s.turns || 0) + 1;

    let context = null;
    if (s.checkpointNudgedAtTurn == null && s.turns >= CHECKPOINT_TURN_THRESHOLD) {
      s.checkpointNudgedAtTurn = s.turns;
      context =
        `<airport-authority-checkpoint>\n` +
        [
          `🧭 This session is getting long (${s.turns} turns).`,
          `A good habit: run /takeoff to save state, then /clear to start fresh —`,
          `Claude works best earlier in a context window. Ignore if you're mid-thought.`,
        ].join('\n') +
        `\n</airport-authority-checkpoint>`;
    }

    state.writeState(sessionId, s);
    return emit(context);
  } catch (err) {
    state.log('checkpoint-nudge', `unexpected error: ${err.message}`);
    return emit(null);
  }
});
