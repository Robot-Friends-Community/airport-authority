# Contributing to Distill

Thanks for your interest in contributing! Distill is a Claude Code skill for extracting reusable patterns from work sessions.

## Getting Started

1. Fork the repo
2. Clone your fork to `~/.claude/skills/distill/`
3. Make your changes
4. Test in a real Claude Code session
5. Open a PR

## Testing Changes

### Skill behavior changes (SKILL.md or references/)

1. Copy the modified skill to your `~/.claude/skills/distill/` directory
2. Run `/distill` in a session where you've just done meaningful work
3. Verify the wizard phases complete correctly (Surface → Refine → Package → Verify)
4. Test all three output types: Skill, Specialist, SOP
5. Test multi-pattern sessions (select multiple patterns in Phase 1)
6. Test edge cases: pattern too small for a skill, pattern spanning multiple skills, updating an existing skill

### Template changes (references/TEMPLATES.md or templates/)

1. Update the template
2. Run through a full wizard session and verify the packaged output uses the updated template
3. Check that all placeholder variables are filled correctly

### Documentation changes

1. Update README.md and CHANGELOG.md as needed
2. Keep the changelog entry in every PR

## Commit Messages

Use conventional commits:

- `feat:` — New feature or capability
- `fix:` — Bug fix or wizard correction
- `docs:` — Documentation only
- `refactor:` — Change that neither fixes a bug nor adds a feature
- `templates:` — Template updates

## Reporting Issues

Use the issue templates for bug reports and feature requests. Include:

- Your OS (macOS, Linux, Windows)
- Claude Code version
- What pattern you were trying to distill
- What output type you targeted (Skill, Specialist, SOP)
- Steps to reproduce (for bugs)
- What you expected vs. what happened

## Questions?

Open a [discussion](../../discussions) or file an issue.
