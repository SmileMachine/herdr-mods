# Herdr Port Manager

Experimental Herdr mod for inspecting TCP listeners in one place. The preview can scan the local computer and machines with open spaces, show attributed listeners first in Space order, followed by other listeners grouped by machine and attribution, show process details, switch between process-tree and working-directory attribution, and filter the visible list by process name or port. Regex filters use RE2JS to avoid catastrophic backtracking; RE2 syntax does not support lookaround or backreferences. Records with unknown process names remain visible when a name filter is active.

The ready-machines option is experimental: it only includes machines already reported as ready by Herdr, not all configured machines without spaces. The forwarding preview can start a loopback-only SSH forward for a discovered remote listener, select the local port, inspect managed forwards, edit a mapping, and stop a verified forward. Editing stops the current mapping and starts a new one with the selected local port. The status-bar mod owns these operations so dismissing the popup does not intentionally cancel them. SSH authentication must work without an interactive prompt; if Herdr does not inherit the SSH agent, configure its socket in Settings.

A forward whose ownership cannot be verified is reported as unknown and is not stopped automatically. An interrupted launch may require manual investigation in Herdr terminals before retrying. Stopping uses fresh identity and listener checks, but Herdr does not expose an atomic compare-and-kill operation, so a race remains. Treat this as an experimental preview. The scan interval can be set to 5, 10, 30 or 60 seconds; scans run while the window is active. Sidebar integration and full machine enumeration are not implemented yet.

## Installation

Copy `port-manager/mods/port-manager/` from this repository to `~/.config/herdr-app/mods/port-manager/`, taking care not to overwrite an existing mod. Add the `port-manager` mod to the status bar of the layout you use. Its runtime asset paths are relative to the Herdr configuration directory and do not change with this repository layout.

## Development and checks

Run `npm test` from the repository root for the host-side tests. After installation, run `herdr-app check mods/port-manager` from `~/.config/herdr-app` for initial mod rendering; it does not validate later interaction or remote operation. Installation and actual GUI acceptance are separate steps.

`docs/design.md` is the original proposal, not a description of completed features. See `RECIPE.md` and the implementation for the current scope.
