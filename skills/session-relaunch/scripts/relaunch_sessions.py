#!/usr/bin/env python3
"""
relaunch_sessions.py — reopen all your Claude Code sessions after a restart (Windows + Windows Terminal).

Opens ONE Windows Terminal window with a tab per session, each:
  - titled exactly as you had it (name + order preserved) and title-LOCKED
  - cd'd into that session's folder
  - started in bypass-permissions mode (--dangerously-skip-permissions)
  - auto-running /landing so it restores from that folder's FLIGHT-LOG.md

Title-lock: tabs launch under a hidden WT profile ("Claude Relaunch") with
suppressApplicationTitle=true, so Claude Code can't overwrite your tab names. Your normal tabs are
unaffected. The profile is created idempotently (backs up settings.json once).

Session source (in priority order):
  --detect            build the list from recently-active transcripts (~/.claude/projects/*/*.jsonl)
  --config <path>     read {"sessions":[{"title","path"},...]} (default: ~/.claude/session-relaunch.json)

Common usage:
    python relaunch_sessions.py --detect --json          # list active sessions as JSON (for the skill)
    python relaunch_sessions.py --detect --save-config    # bootstrap the config from detection
    python relaunch_sessions.py                          # relaunch from the saved config
    python relaunch_sessions.py --dry-run                # preview, launch nothing
    python relaunch_sessions.py --no-landing             # open at the prompt, don't auto-run /landing
    python relaunch_sessions.py --setup-profile          # only (re)create the WT title-lock profile

It only LAUNCHES — never kills anything. Close your current sessions first, then run it.
"""

import argparse
import glob
import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

CONFIG_PATH     = Path.home() / ".claude" / "session-relaunch.json"
WT_WINDOW       = "session-relaunch"
PROFILE_NAME    = "Claude Relaunch"
PROFILE_GUID    = "{2c5f9e00-1a2b-4c3d-9e8f-a1b2c3d4e5f6}"
BYPASS_FLAG     = "--dangerously-skip-permissions"
LANDING_PROMPT  = "/landing"
INTER_TAB_DELAY = 0.4


def pwsh_path() -> str:
    return shutil.which("pwsh") or r"C:\Program Files\PowerShell\7\pwsh.exe"


# ── Windows Terminal title-lock profile ──────────────────────────────────────────────

def wt_settings_path() -> Path | None:
    base = Path(os.environ.get("LOCALAPPDATA", "")) / "Packages"
    for pkg in ("Microsoft.WindowsTerminal_8wekyb3d8bbwe",
                "Microsoft.WindowsTerminalPreview_8wekyb3d8bbwe"):
        p = base / pkg / "LocalState" / "settings.json"
        if p.exists():
            return p
    p = Path(os.environ.get("APPDATA", "")) / "Microsoft" / "Windows Terminal" / "settings.json"
    return p if p.exists() else None


def ensure_profile(verbose: bool = True) -> bool:
    sp = wt_settings_path()
    if not sp:
        print("WARN: WT settings.json not found — tab titles may get overwritten by Claude Code.", file=sys.stderr)
        return False
    try:
        data = json.loads(sp.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"WARN: could not parse {sp} ({e}) — skipping profile setup.", file=sys.stderr)
        return False
    lst = data.setdefault("profiles", {}).setdefault("list", [])
    existing = next((p for p in lst if p.get("name") == PROFILE_NAME or p.get("guid") == PROFILE_GUID), None)
    desired = {
        "name": PROFILE_NAME, "guid": PROFILE_GUID,
        "commandline": pwsh_path(), "suppressApplicationTitle": True, "hidden": True,
    }
    if existing and all(existing.get(k) == v for k, v in desired.items()):
        if verbose: print(f"WT profile '{PROFILE_NAME}': already present.")
        return True
    shutil.copy2(sp, sp.with_suffix(".json.bak"))
    (existing.update(desired) if existing else lst.append(desired))
    sp.write_text(json.dumps(data, indent=4), encoding="utf-8")
    if verbose: print(f"WT profile '{PROFILE_NAME}': {'updated' if existing else 'created'} (backup: {sp.name}.bak).")
    return True


# ── Session sources ──────────────────────────────────────────────────────────────────

def detect_sessions(minutes: int) -> list[dict]:
    """Build the session list from recently-active Claude Code transcripts."""
    root = Path.home() / ".claude" / "projects"
    now = time.time()
    latest: dict[str, float] = {}
    for jf in glob.glob(str(root / "*" / "*.jsonl")):
        try:
            mt = os.path.getmtime(jf)
        except OSError:
            continue
        if (now - mt) / 60 > minutes:
            continue
        cwd = None
        try:
            with open(jf, encoding="utf-8", errors="ignore") as fh:
                for line in fh:
                    try:
                        d = json.loads(line)
                        if isinstance(d, dict) and d.get("cwd"):
                            cwd = d["cwd"]
                    except Exception:
                        pass
        except OSError:
            continue
        if cwd and mt > latest.get(cwd, 0):
            latest[cwd] = mt
    return [{"title": Path(c).name.upper()[:16], "path": c}
            for c, _ in sorted(latest.items(), key=lambda x: -x[1])]


def load_config(path: Path) -> list[dict]:
    if not path.exists():
        return []
    try:
        return json.loads(path.read_text(encoding="utf-8")).get("sessions", [])
    except Exception as e:
        print(f"WARN: could not read config {path} ({e}).", file=sys.stderr)
        return []


def save_config(path: Path, sessions: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"sessions": sessions}, indent=2), encoding="utf-8")
    print(f"Saved {len(sessions)} session(s) to {path}")


# ── Launch ───────────────────────────────────────────────────────────────────────────

def build_pwsh_command(path: str, run_landing: bool) -> str:
    # -Command runs AFTER the pwsh profile (which may Set-Location elsewhere), so ours wins.
    # `&&` chains the statements — wt treats `;` as a tab separator, `&&` is safe.
    launch = f"claude {BYPASS_FLAG}" + (f" '{LANDING_PROMPT}'" if run_landing else "")
    return f"Set-Location -LiteralPath '{path}' && {launch}"


def wt_args(title: str, path: str, run_landing: bool, use_profile: bool) -> list[str]:
    argv = ["wt", "-w", WT_WINDOW, "new-tab"]
    if use_profile:
        argv += ["--profile", PROFILE_NAME]
    argv += ["--title", title, "pwsh", "-NoExit", "-Command", build_pwsh_command(path, run_landing)]
    return argv


def main() -> int:
    ap = argparse.ArgumentParser(description="Relaunch all Claude Code sessions in Windows Terminal.")
    ap.add_argument("--detect", action="store_true", help="build the list from recent transcripts")
    ap.add_argument("--minutes", type=int, default=180, help="with --detect: activity window (default 180)")
    ap.add_argument("--config", type=Path, default=CONFIG_PATH, help=f"session config (default {CONFIG_PATH})")
    ap.add_argument("--json", action="store_true", help="print the resolved session list as JSON and exit")
    ap.add_argument("--save-config", action="store_true", help="write the resolved list to --config and exit")
    ap.add_argument("--setup-profile", action="store_true", help="only (re)create the WT title-lock profile")
    ap.add_argument("--no-setup", action="store_true", help="skip the WT profile step")
    ap.add_argument("--no-landing", action="store_true", help="don't auto-run /landing")
    ap.add_argument("--dry-run", action="store_true", help="print the wt commands, launch nothing")
    args = ap.parse_args()

    if args.setup_profile:
        return 0 if ensure_profile() else 3

    sessions = detect_sessions(args.minutes) if args.detect else load_config(args.config)

    if args.json:
        print(json.dumps(sessions, indent=2))
        return 0
    if args.save_config:
        save_config(args.config, sessions)
        return 0
    if not sessions:
        src = "detection" if args.detect else str(args.config)
        print(f"No sessions found ({src}). Run with --detect --save-config to bootstrap, "
              f"or have the session-relaunch skill build the mapping.", file=sys.stderr)
        return 1

    use_profile = not args.no_setup
    if use_profile and not args.dry_run:
        use_profile = ensure_profile()

    run_landing = not args.no_landing
    print(f"{'DRY RUN - ' if args.dry_run else ''}Relaunching {len(sessions)} session(s) into WT window "
          f"'{WT_WINDOW}' | bypass=on | landing={'on' if run_landing else 'off'} | "
          f"title-lock={'on' if use_profile else 'off'}\n")

    for s in sessions:
        title, path = s["title"], s["path"]
        flag = "" if Path(path).exists() else "  [!! path not found - launching anyway]"
        print(f"  - {title:<14} {path}{flag}")
        argv = wt_args(title, path, run_landing, use_profile)
        if args.dry_run:
            print("      " + " ".join(f'"{a}"' if " " in a else a for a in argv))
            continue
        try:
            subprocess.Popen(argv, close_fds=True)
        except FileNotFoundError:
            print("ERROR: 'wt' (Windows Terminal) not found on PATH.", file=sys.stderr)
            return 2
        time.sleep(INTER_TAB_DELAY)

    if not args.dry_run:
        print("\nLaunched. In each tab, /landing restores that folder's FLIGHT-LOG.md.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
