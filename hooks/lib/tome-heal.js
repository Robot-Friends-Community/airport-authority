/**
 * Airport Authority — Tome front-page staleness note (Flight Ops v1.2, bead A1; Tier B).
 *
 * Scope, ratified by the user 2026-08-07 ("honest staleness note"): on a KEEPER
 * project (a TOME.md at the working-dir root), when the front-page
 * "Current Session" marker has fallen BEHIND the Flight Recorder — the classic
 * "a session closed without /canon-keeper takeoff, so the repo moved but canon
 * didn't" drift — annotate the marker line IN PLACE so the staleness is
 * impossible to miss, and point to the real fix.
 *
 * It NEVER fabricates a fresh date, NEVER rewrites canon content, and NEVER
 * commits. The edit is left uncommitted for the user's review (`git restore
 * TOME.md` undoes it). The real reconcile — `/canon-keeper takeoff`, which
 * regenerates the whole front page with the human in the loop — stays a
 * surfaced suggestion; this only makes the drift visible in the file itself.
 *
 * Contract (Tier B):
 *   1. Touches exactly ONE line (the `**Last session:**` marker) of ONE file
 *      (TOME.md in cwd). Never the rest of the Tome, never the repo/history.
 *   2. Honest — the original date is preserved verbatim; we only append/refresh
 *      a machine-managed `<!-- aa-stale: ... -->` note. Never claims freshness.
 *   3. Reversible + idempotent both ways: annotate when stale, clear the note
 *      when the front page catches up. A no-op when already correct.
 *   4. Offline, never throws.
 */

const fs = require('fs');
const path = require('path');
const { log } = require('./session-state');

const TOME_FILE = 'TOME.md';
const RECORDER_FILE = 'FLIGHT-RECORDER.md';

// Machine-managed note appended to the marker line. Matched to strip/refresh it
// so runs are idempotent and the user's real content is never disturbed.
const NOTE_RE = /\s*<!--\s*aa-stale:[^>]*-->\s*$/i;
// The `**Last session:**` marker line, matched within the file (m: per-line).
const MARKER_RE = /^[ \t]*\*\*Last session:\*\*.*$/im;

/** Newest ISO (YYYY-MM-DD) date in a blob, or null. ISO strings sort chronologically. */
function newestIsoDate(text) {
  let max = null;
  const re = /\b(\d{4}-\d{2}-\d{2})\b/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (max === null || m[1] > max) max = m[1];
  }
  return max;
}

function buildNote(recorderDate) {
  return `  <!-- aa-stale: recorder advanced to ${recorderDate}; run /canon-keeper takeoff to reconcile -->`;
}

/**
 * Reconcile (annotate/clear) the Tome front-page marker for the project at cwd.
 * Never throws.
 *
 * @param {string} cwd  the session working directory
 * @returns {null | {action:'annotated'|'cleared', markerDate:string, recorderDate:string, file:string}}
 */
function reconcileTomeMarker(cwd) {
  try {
    if (!cwd) return null;

    const tomePath = path.join(cwd, TOME_FILE);
    if (!fs.existsSync(tomePath)) return null; // not a keeper project — skip cleanly

    const recPath = path.join(cwd, RECORDER_FILE);
    if (!fs.existsSync(recPath)) return null; // nothing to compare against

    const recorderDate = newestIsoDate(fs.readFileSync(recPath, 'utf8'));
    if (!recorderDate) return null;

    const original = fs.readFileSync(tomePath, 'utf8');
    const match = original.match(MARKER_RE);
    if (!match) return null; // no front-page marker to reconcile

    const fullLine = match[0];
    const bare = fullLine.replace(NOTE_RE, ''); // marker without any prior note
    const markerDate = newestIsoDate(bare);
    if (!markerDate) return null; // unparseable marker — leave it, surface-only elsewhere

    const stale = markerDate < recorderDate;
    const newLine = stale ? `${bare}${buildNote(recorderDate)}` : bare;
    if (newLine === fullLine) return null; // already correct — idempotent no-op

    // Replace ONLY the marker line; the string form of replace swaps the first
    // literal occurrence, so every other byte (and line ending) is untouched.
    const updated = original.replace(fullLine, newLine);
    fs.writeFileSync(tomePath, updated);

    const action = stale ? 'annotated' : 'cleared';
    log('aa-tome-heal', `${action} Tome marker (marker=${markerDate}, recorder=${recorderDate}) in ${tomePath}`);
    return { action, markerDate, recorderDate, file: TOME_FILE };
  } catch (err) {
    log('aa-tome-heal', `reconcileTomeMarker error: ${err.message}`);
    return null;
  }
}

/** One-line inline announcement for a reconcile result, or null. */
function summarizeTome(result) {
  if (!result) return null;
  if (result.action === 'annotated') {
    return (
      `📖 Tome front page looks stale — recorder advanced to ${result.recorderDate}, ` +
      `front page still says ${result.markerDate}. Flagged in ${result.file} (uncommitted); ` +
      `run /canon-keeper takeoff to reconcile.`
    );
  }
  // 'cleared'
  return `📖 Tome front page caught up — removed the stale note from ${result.file}.`;
}

module.exports = { reconcileTomeMarker, summarizeTome, newestIsoDate };
