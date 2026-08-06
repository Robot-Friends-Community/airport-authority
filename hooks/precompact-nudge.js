#!/usr/bin/env node
/**
 * Airport Authority — precompact-nudge  (PreCompact hook)
 *
 * Fires right before Claude Code compacts the context window. Compaction
 * summarizes and drops detail — so this is the last clean moment to preserve
 * full state. Nudge the user to run /takeoff.
 *
 * Fires on both automatic (threshold) and manual (/compact) compaction; the
 * data.trigger field distinguishes them. We only add a gentle line either way.
 *
 * Never breaks a session: wrapped, always exits 0 with a valid response.
 */

const state = require('./lib/session-state');

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => { input += c; });
process.stdin.on('end', () => {
  try {
    let data = {};
    try {
      data = JSON.parse(input);
    } catch (err) {
      state.log('precompact-nudge', `JSON parse error: ${err.message}`);
    }

    const trigger = data.trigger === 'manual' ? 'manual' : 'auto';
    const lead =
      trigger === 'manual'
        ? `You're compacting the context.`
        : `Context is about to compact automatically (it's getting full).`;

    const message = [
      `🗜️  ${lead}`,
      `Compaction summarizes and drops detail. Run /takeoff first to preserve the`,
      `full session state (flight log + recorder) before anything is lost.`,
    ].join('\n');

    console.log(
      JSON.stringify({
        continue: true,
        suppressOutput: true,
        hookSpecificOutput: {
          hookEventName: 'PreCompact',
          additionalContext: `<airport-authority-precompact>\n${message}\n</airport-authority-precompact>`,
        },
      })
    );
    process.exit(0);
  } catch (err) {
    state.log('precompact-nudge', `unexpected error: ${err.message}`);
    console.log(JSON.stringify({ continue: true, suppressOutput: true }));
    process.exit(0);
  }
});
