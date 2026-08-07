#!/usr/bin/env node
/**
 * Airport Authority — flight-recorder-check  (SessionEnd hook)
 *
 * Fires when the session ends (including /clear and /exit).
 * If a Flight Recorder is configured for this project and was NOT updated
 * during this session → leave a .flight-recorder-warning.json that the next
 * session's flight-status hook surfaces once.
 *
 * SELF-CONTAINED refactor: session start time now comes from the Airport
 * Authority per-session state file (stamped by flight-status at SessionStart),
 * NOT from ~/.claude/History/TimeTracking/active-session.json. That personal
 * time-tracker file doesn't exist on teammates' machines, so the old check
 * always saw sessionStart=null and fired false "you missed /takeoff" warnings.
 *
 * Cleanup: this hook deletes its own session state file on the way out.
 *
 * KNOWN LIMITATION (v1, Codex review — HIGH but non-blocking): "was the recorder
 * saved this session?" is inferred from FLIGHT-RECORDER.md mtime vs this session's
 * start time. It is therefore project-level, not session-level: if two sessions
 * share a project and session B runs /takeoff, session A can end unsaved without a
 * warning (A sees a recorder newer than its own start). The warning is an ADVISORY
 * nudge, not a guarantee, and this fails safe (a missed reminder, never data loss or
 * a crash) — and it is still strictly better than the old hook, which was fully
 * broken for anyone without the personal time-tracker. A true per-session fix would
 * have /takeoff stamp `tookOffAt` into this session's state file and check that here;
 * deferred to v1.1 so it isn't a merge blocker.
 */

const fs = require('fs');
const path = require('path');
const state = require('./lib/session-state');
const alert = require('./lib/alert');

function readYamlField(content, key) {
  const match = content.match(new RegExp(`^\\s*${key}:\\s*(.+)$`, 'm'));
  return match ? match[1].trim() : null;
}

function isRecorderEnabled(cwd) {
  const configPath = path.join(cwd, '.flight-recorder.yml');
  if (!fs.existsSync(configPath)) return false;
  try {
    return readYamlField(fs.readFileSync(configPath, 'utf8'), 'enabled') === 'true';
  } catch (err) {
    state.log('flight-recorder-check', `could not read .flight-recorder.yml: ${err.message}`);
    return false;
  }
}

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => { input += c; });
process.stdin.on('end', () => {
  let sessionId = null;
  try {
    let data;
    try {
      data = JSON.parse(input);
    } catch (err) {
      state.log('flight-recorder-check', `JSON parse error: ${err.message}`);
      process.exit(0);
    }

    const cwd = data.cwd;
    sessionId = data.session_id;
    const reason = data.reason || 'unknown';
    state.log('flight-recorder-check', `session ending — reason: ${reason}, cwd: ${cwd}`);

    if (!cwd) {
      state.log('flight-recorder-check', 'no cwd, skipping');
      return finish(sessionId);
    }

    if (!isRecorderEnabled(cwd)) {
      state.log('flight-recorder-check', 'no flight recorder configured, skipping');
      return finish(sessionId);
    }

    const recorderPath = path.join(cwd, 'FLIGHT-RECORDER.md');
    if (!fs.existsSync(recorderPath)) {
      state.log('flight-recorder-check', 'FLIGHT-RECORDER.md does not exist yet, skipping');
      return finish(sessionId);
    }

    // Session start time now comes from our own state file.
    const s = state.readState(sessionId);
    const sessionStart = s && s.startTime ? new Date(s.startTime) : null;
    const recorderMtime = fs.statSync(recorderPath).mtime;

    if (sessionStart && recorderMtime > sessionStart) {
      state.log(
        'flight-recorder-check',
        `recorder updated this session (${recorderMtime.toISOString()} > ${sessionStart.toISOString()}), no warning`
      );
      return finish(sessionId);
    }

    // If we somehow have no start stamp, fall back to warning only when the
    // recorder is clearly stale (older than 6h) — avoids nagging on a fresh
    // session whose SessionStart hook didn't run for some reason.
    if (!sessionStart) {
      const ageMs = Date.now() - recorderMtime.getTime();
      if (ageMs < 6 * 60 * 60 * 1000) {
        state.log('flight-recorder-check', 'no start stamp but recorder is recent, skipping warning');
        return finish(sessionId);
      }
    }

    const warningPath = path.join(cwd, '.flight-recorder-warning.json');
    try {
      fs.writeFileSync(
        warningPath,
        JSON.stringify(
          {
            missedAt: new Date().toISOString(),
            reason,
            sessionStarted: sessionStart ? sessionStart.toISOString() : null,
            recorderLastUpdated: recorderMtime.toISOString(),
            cwd,
          },
          null,
          2
        )
      );
      state.log('flight-recorder-check', `warning written (recorder last updated ${recorderMtime.toISOString()})`);
    } catch (err) {
      // Couldn't leave the missed-takeoff breadcrumb — queue it so the lapse
      // still reaches the next session + #rf-alerts instead of vanishing.
      state.log('flight-recorder-check', `could not write warning: ${err.message}`);
      alert.enqueue({
        kind: 'durable-write-failure',
        severity: alert.SEVERITY.YELLOW,
        message: 'Session ended without /takeoff and the recorder-warning breadcrumb could not be written.',
        cwd,
        sessionId,
        detail: 'recorder-warning',
      });
    }
    return finish(sessionId);
  } catch (err) {
    state.log('flight-recorder-check', `unexpected error: ${err.message}`);
    return finish(sessionId);
  }
});

function finish(sessionId) {
  // Session is over — drop its state file.
  if (sessionId) state.deleteState(sessionId);
  process.exit(0);
}
