#!/usr/bin/env node
/**
 * Airport Authority — checkpoint-nudge  (Stop hook)
 *
 * Fires each time Claude finishes responding (one assistant turn). Two jobs:
 *
 *  1. CHECKPOINT NUDGE: count turns and, once past a heuristic threshold, nudge
 *     ONCE to /takeoff + /clear so the user stays in the "fresh context" zone.
 *
 *  2. FLIGHT OPS CADENCE PROBE (v1.1 Component 2): every Nth turn, run a cheap,
 *     offline health probe (lib/probe.js) and ENQUEUE any work-at-risk findings
 *     (uncommitted pileup, unpushed commits) to the alert queue — so problems
 *     surface DURING a long session, not only when the user runs /flight-engineer
 *     or starts fresh. Each condition is also surfaced inline ONCE per session;
 *     the alert queue's dedup/coalesce keeps repeats from nagging.
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
const alert = require('./lib/alert');
const probe = require('./lib/probe');

// Heuristic proxy for "~half the context used." Tunable; deliberately not
// aggressive — nagging early would train users to ignore it.
const CHECKPOINT_TURN_THRESHOLD = 25;

// Run the health probe every Nth turn. Amortizes the (bounded) git cost so the
// Stop hook stays snappy on the other turns.
const PROBE_TURN_INTERVAL = 10;

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

    // C2: if a sibling hook copy (legacy ~/.claude install + plugin both
    // present) just handled this same Stop event, bow out — no double
    // turn-count, no double nudge. Real turns are seconds apart, far outside
    // the debounce window.
    if (!state.claimEvent(sessionId, 'Stop', 1200)) return emit(null);

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

    const messages = [];

    // (1) Checkpoint nudge — once per session, past the threshold.
    if (s.checkpointNudgedAtTurn == null && s.turns >= CHECKPOINT_TURN_THRESHOLD) {
      s.checkpointNudgedAtTurn = s.turns;
      messages.push(
        `<airport-authority-checkpoint>\n` +
          [
            `🧭 This session is getting long (${s.turns} turns).`,
            `A good habit: run /takeoff to save state, then /clear to start fresh —`,
            `Claude works best earlier in a context window. Ignore if you're mid-thought.`,
          ].join('\n') +
          `\n</airport-authority-checkpoint>`
      );
    }

    // (2) Flight Ops cadence probe — every Nth turn (Component 2). Enqueue any
    // work-at-risk findings (durable; dedup/coalesce handles repeats) and
    // surface each condition inline at most ONCE per session.
    if (s.turns % PROBE_TURN_INTERVAL === 0 && s.lastProbedAtTurn !== s.turns) {
      s.lastProbedAtTurn = s.turns;
      try {
        const findings = probe.healthProbe(data.cwd || s.cwd);
        const surfaced = s.probeSurfaced || (s.probeSurfaced = {});
        const fresh = [];
        for (const f of findings) {
          // Only claim "queued" and suppress future inline surfacing if the
          // enqueue actually persisted — enqueue() returns false on a write/lock
          // failure. On failure we leave the condition un-surfaced so a later
          // probe retries, rather than lying about a queued alert.
          const queued = alert.enqueue({ ...f, sessionId }); // durable (Component 1)
          if (queued && !surfaced[f.kind]) {
            surfaced[f.kind] = s.turns; // inline once per condition per session
            fresh.push(f);
          }
        }
        if (fresh.length) {
          messages.push(
            `<airport-authority-flight-ops>\n` +
              [
                `⚠️  Flight Ops probe (turn ${s.turns}):`,
                ...fresh.map((f) => `  🟡 ${f.message}`),
                ``,
                `Queued to #rf-alerts. Run /flight-engineer to review, or just commit/push to clear it.`,
              ].join('\n') +
              `\n</airport-authority-flight-ops>`
          );
        }
      } catch (err) {
        state.log('checkpoint-nudge', `probe error: ${err.message}`);
      }
    }

    state.writeState(sessionId, s);
    return emit(messages.length ? messages.join('\n\n') : null);
  } catch (err) {
    state.log('checkpoint-nudge', `unexpected error: ${err.message}`);
    return emit(null);
  }
});
