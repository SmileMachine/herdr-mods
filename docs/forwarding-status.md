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

Current environment observation on 2026-11-19: `hc machine ls --json` returned
an empty list. Remote execution, actual SSH startup, shutdown, disconnect,
conflict handling and restart recovery have not been verified. No configured
machine was added or contacted for these tests.
