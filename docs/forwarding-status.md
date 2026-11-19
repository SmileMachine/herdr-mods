# SSH forwarding implementation status

The GUI does not expose forwarding yet. No code in the current plan and ownership
modules starts or stops a process. These modules are groundwork, not proof that
forwarding or recovery is safe.

- `forward-plan.js` validates port numbers and SSH targets, rejects `--via`
  command-based machines, and creates an argv-based loopback-only SSH plan.
  Specific IP listeners are retained; wildcard listeners use their address
  family's loopback. A random 128-bit identity is required from a secure source.
- `forward-ownership.js` requires a local, live, labelled terminal, an `ssh`
  process in its ancestry and an exact `127.0.0.1` listener. This is a
  preliminary check only: the label and current PID tree do not by themselves
  prove that the process is the exact forward we started. PID reuse, a changed
  program and spoofed labels remain possible.

Before wiring a stop action, establish a durable identity and verify fresh
process command/arguments, process start identity, the terminal association,
and exact destination and bind arguments. If identity is unavailable, report
unknown and do not kill. Test the unavoidable race between verification and
termination. Starting requires conflict handling, SSH exit detection and
failure/timeout cleanup without stopping someone else's process. Replacing a
mapping needs an explicit state machine that reports whether the old or new
forward is actually live. The host may not expose enough information to prove
all of this; do not silently lower the ownership standard.

Environment observation on 2026-11-19: `mbp` is now configured and connected;
remote `hc exec` works and reports Darwin with `lsof`, `ps`, and `python3`.
A local `hc run` of SSH without agent configuration exited 255 with public-key
authentication failure: the core's child environment has an empty
`SSH_AUTH_SOCK`. A controlled test using an explicitly specified macOS launchd
agent socket started successfully. `hc get` reported the actual SSH PID,
creation time and argument vector, and `lsof` independently showed that PID
owned the requested `127.0.0.1` listener. The test terminal was killed and
removed; its listener disappeared. This did not test end-to-end traffic,
port races, disconnect, restart recovery, replacement, or agent configuration
portability. Never assume the observed launchd socket path is stable.
