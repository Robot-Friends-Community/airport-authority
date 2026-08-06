# Beads / Dolt Recovery Playbook

The step-by-step for a wedged beads board. Written from a real incident (Acme engagement, 2026-08-04): a board on a shared NAS (`\\192.168.1.x\shared` mounted as S:) that would not start — every `bd` call errored with `Dolt server unreachable at 127.0.0.1:0` then, on retry, `database "dolt" is locked by another dolt process`. Two machines (the user + Alex) both pointed `BEADS_DIR` at the same on-share `.beads`.

**The misdiagnosis to avoid:** it looked like a stale lock held by a dead process. It was NOT. It was the **slow-start-over-SMB pile-up**: Dolt takes ~12s to accept connections when its store is on an SMB share; bd's auto-start times out at ~10s and reports failure while the server is still coming up; the next bd call spawns a second server that collides with the first → "locked." Killing processes made it worse (each attempt left another slow-starting server).

---

## Step 0 — set the project BEADS_DIR every time

```bash
export BEADS_DIR="/s/client-projects/<project>/.beads"   # or the S:/... form on Windows bash
```
If `bd ready` returns the wrong issue prefix, a user-wide `BEADS_DIR` is hijacking it — this export fixes it.

## Step 1 — is any Dolt actually alive? (on EVERY machine)

```powershell
Get-CimInstance Win32_Process -Filter "Name='dolt.exe'" |
  Select-Object ProcessId,CreationDate,@{n='Port';e={if($_.CommandLine -match '-P (\d+)'){$matches[1]}}} | Format-Table -Auto
```
- **Zero dolt.exe on all machines, still "locked"** → it's the timeout pile-up (Step 3), not a real lock.
- **A live dolt.exe on another machine/session** → that's a real holder. Stop it there (`bd dolt stop`, or `Stop-Process`), then retry.

## Step 2 — confirm the share is the problem, not corruption

```powershell
(Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='S:'").ProviderName   # \\host\share => SMB
```
If the `.beads` is on `\\...` / a mapped network drive, you're in the trap. The storage itself is fine (it's a lock/timeout issue, not data loss).

## Step 3 — the decisive test: manual start with real patience

```bash
cd "$BEADS_DIR"
rm -f sql-server.info dolt-server.port          # clear stale pointers
cd dolt
"/c/Users/User/.local/bin/dolt.exe" sql-server -H 127.0.0.1 -P 47700 -l warning \
  > /tmp/dolt-test.log 2>&1 &
# poll up to ~36s
for i in $(seq 1 18); do sleep 2; (echo > /dev/tcp/127.0.0.1/47700) 2>/dev/null && { echo "UP after ~$((i*2))s"; break; }; done
tail -12 /tmp/dolt-test.log
```
Read the log:
- **Comes up (~10-15s), NO "locked" line** → confirmed timeout, not a lock. Go to Step 4.
- **"database is locked by another dolt process"** → a real live server holds it (Step 1 missed it, or it's a third machine). Find and stop it.
- A lone `Cannot send HandshakeV10 ... connection was aborted` is harmless — that's your `/dev/tcp` probe opening+closing.

## Step 4 — point bd at the running server

```bash
printf '47700' > "$BEADS_DIR/dolt-server.port"    # bd's primary port source
bd ready | grep -c '<prefix>-'                     # expect a real count
```
(If the port file alone isn't honored, also write `PID:47700:manual` to `dolt/.dolt/sql-server.info`.)

## Step 5 — RESCUE THE DATA before changing anything

```bash
cp "$BEADS_DIR/issues.jsonl" "$BEADS_DIR/issues.jsonl.bak-$(stamp)"   # back up the old export
bd export --all -o issues.jsonl                                       # fresh, complete
grep -c '"id":"<prefix>-' "$BEADS_DIR/issues.jsonl"                   # sanity count
```
⚠️ The existing `issues.jsonl` may be **months stale** (auto-export off). Never flip to `no-db: true` on top of a stale export — you'll lose everything since it. Export fresh FIRST.

## Step 6 — housekeeping

```bash
: > "$BEADS_DIR/dolt-server.log"    # failed starts bloat this to MBs of handshake spam
```

## Step 7 — stop it recurring

Migrate off the shared-drive Dolt per the parent SKILL:
- **Model C (shared external Dolt sql-server):** BEST when the team has an always-on box everyone can reach (homelab/VPS). One server owns the single-writer lock on its own local disk; every machine connects over a private network (Tailscale). Real-time concurrent access, no shared on-drive DB, no push/pull. This is the RF reference topology.
- **Model B (local Dolt + Dolt remote):** each machine's `.beads` on local disk, sync via `bd dolt push/pull` to a shared remote. Use when there's no always-on server.
- **Model A (JSONL-only + git):** set `no-db: true` in `config.yaml`, board lives in a GitHub repo, each machine clones locally, sync via git. Simplest — but only if your bd build honors `no-db` (many don't; test first per the parent SKILL).

Do the migration deliberately and with the whole team — everyone repoints to the shared server (Model C) or re-clones to a LOCAL path (A/B) and stops pointing `BEADS_DIR` at the share.

---

### Windows SMB note (if it really is a stale server-side lock)

If Step 1 shows a live holder on another box you can't reach, or a lock genuinely survives all processes dying, the SMB server (NAS) may hold a byte-range lock from an abruptly-killed client. Options, least-disruptive first:
1. Wait ~15 min for the server's idle lock timeout.
2. On the machine whose dead process held it: drop that machine's SMB session so the server releases its locks — `net use <DriveLetter>: /delete /y` then remap (persistent mappings auto-reconnect with saved creds; deleting the bare `\\host\share` UNC is a no-op when it's mapped to a letter).
3. Reboot the client that held it.
But verify Step 3 first — 9 times out of 10 it's the timeout, not a real stale lock.
