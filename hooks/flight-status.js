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
 *  4. SURFACE any unsent Flight Ops alerts (durable-write failure, Tome drift,
 *     uncommitted pileup, failing CI) that hooks/skills queued locally. This is
 *     the guaranteed, network-free delivery path — even offline you see what
 *     bit you; /flight-engineer later flushes them to Slack #rf-alerts.
 *
 *  5. SELF-HEAL (v1.1 Component 3, Tier A): a janitor pass over AA's OWN state
 *     dir (lib/self-heal.js) — quarantine any corrupt state file (original kept
 *     as .bak) and prune dead orphans, announced. Replaces the silent sweep.
 *     Bounded to AA bookkeeping; never the repo, your work, or git history.
 *
 * A hook must never break a session: everything is wrapped, and we always
 * print a valid response and exit 0.
 */

const fs = require('fs');
const path = require('path');
const state = require('./lib/session-state');
const alert = require('./lib/alert');
const selfHeal = require('./lib/self-heal');
const tomeHeal = require('./lib/tome-heal');

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

    // C2: bow out if a sibling hook copy (legacy ~/.claude install + plugin both
    // present) just handled this same SessionStart — avoids a double stamp and
    // double-printed nudges. Session starts never repeat within the window.
    if (sessionId && !state.claimEvent(sessionId, 'SessionStart', 2000)) return emit(null);

    // (1) Stamp the session start — the crux of the dead-warn fix.
    // Component 3 self-heal (Tier A) first: a janitor pass over AA's OWN state
    // dir — quarantine corrupt files (originals preserved as .bak), prune dead
    // orphans. Announced version of the old silent sweep; never touches the
    // repo or your work. Runs BEFORE the stamp so a corrupt file for THIS
    // session (e.g. a resumed/re-fired start) is freed and re-stamped valid.
    let healResult = null;
    if (sessionId) {
      healResult = selfHeal.tidyStateDir();
      const stamped = state.writeState(sessionId, {
        sessionId,
        cwd: cwd || null,
        startTime: new Date().toISOString(),
        turns: 0,
        checkpointNudgedAtTurn: null,
      });
      // A failed state write means the suite's session tracking is degraded
      // (missed-takeoff warnings + checkpoint nudges won't fire reliably).
      // Queue it so it surfaces + reaches #rf-alerts rather than failing silent.
      if (!stamped) {
        alert.enqueue({
          kind: 'durable-write-failure',
          severity: alert.SEVERITY.YELLOW,
          message: 'Could not write Airport Authority session state — takeoff warnings and checkpoint nudges may not fire.',
          cwd: cwd || null,
          sessionId,
          detail: 'session-state',
        });
      }
    }

    if (!cwd) return emit(null);

    const messages = [];

    // (0) Announce any self-heal actions taken above (Component 3). Each action
    // is already logged to hooks.log inside tidyStateDir; this surfaces it once
    // inline so a repair is never silent.
    try {
      const healMsg = selfHeal.summarizeHeal(healResult);
      if (healMsg) messages.push(healMsg);
    } catch (err) {
      state.log('flight-status', `self-heal summarize error: ${err.message}`);
    }

    // (0b) Tier-B self-heal (v1.2 A1): on a keeper project (TOME.md present),
    // if the front-page marker has fallen behind the recorder, annotate it in
    // place (honest note, never a faked date; uncommitted) and surface it. No-op
    // on non-keeper projects and when the front page is current.
    try {
      const tomeMsg = tomeHeal.summarizeTome(tomeHeal.reconcileTomeMarker(cwd));
      if (tomeMsg) messages.push(tomeMsg);
    } catch (err) {
      state.log('flight-status', `tome-heal error: ${err.message}`);
    }

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

    // (3) Nudge /landing when a handoff exists. Matches every naming shape:
    //   FLIGHT-LOG.md · FLIGHT-LOG.<user>.md · FLIGHT-LOG.<user>.<lane>.md
    //   and hand-rolled hyphen conventions like FLIGHT-LOG-<stream>.md.
    // The separator class is [.-] (not just '.') so dash-named lane logs are
    // not invisible to the nudge, /landing and /tower.
    try {
      const hasHandoff = fs
        .readdirSync(cwd)
        .some((f) => /^FLIGHT-LOG([.-].+)?\.md$/i.test(f));
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

    // (4) Surface unsent Flight Ops alerts (network-free delivery path).
    try {
      const summary = alert.summarizeForInline();
      if (summary) messages.push(summary);
    } catch (err) {
      state.log('flight-status', `alert surface error: ${err.message}`);
    }

    if (messages.length === 0) return emit(null);
    return emit(`<airport-authority-flight-status>\n${messages.join('\n\n')}\n</airport-authority-flight-status>`);
  } catch (err) {
    state.log('flight-status', `unexpected error: ${err.message}`);
    return emit(null);
  }
});
