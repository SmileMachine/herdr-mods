# Port Manager

A status-bar entry opens a compact window for finding TCP listeners on this computer and on machines with spaces. Listeners are grouped by space first, with other listeners below; remote listeners can be forwarded to a local port.

A real `preview.png` screenshot still needs to be captured before sharing this mod in the Herdr gallery.

## What you see

- A status-bar button opens a 480 × 600 px popup titled **Ports**. It uses Herdr's theme colors, compact text and Lucide icons.
- The main list groups space listeners in space order, followed by **Other ports**, grouped by machine and attribution. Groups can be collapsed; **Other process** starts collapsed. Each listener shows its port and address alongside the process name and PID when available. A failed scan can leave the previous results visible as stale.
- Filter, forwards and settings icon buttons open their respective panels. Filters have process-name and port rules. Settings select the attribution strategy and whether to include eligible machines without spaces; advanced settings contain scan interval and SSH agent socket.
- Hovering a listener reveals applicable actions. A local listener can be opened in a browser; a remote listener can be forwarded. A managed forward displays its local destination, with edit and stop actions. The forwards panel also lists managed forwards.

## How it behaves

- The mod scans this computer and machines with spaces. It can additionally scan machines without spaces that Herdr reports as ready. Scans run while the window is active at the configured interval (5, 10, 30 or 60 seconds; default 5).
- The selected attribution strategy associates listeners with a space by terminal process tree or checkout working directory. Filters affect the displayed list, not discovery or existing forwards. Process name filters support text or RE2 syntax; port filters accept ports and ranges.
- Clicking a local port's open action or a managed forward's local destination opens an HTTP URL in the browser. Forwarding a remote port starts an SSH tunnel bound to local loopback. The local port can be chosen, and a managed mapping can be edited or stopped. Editing stops the existing mapping and starts a new one.
- Group headings expand and collapse. Other process groups start collapsed; the other headings start expanded. Actions expose tooltips and keyboard-accessible labels.

## Built from

- `mods/port-manager/`: the status-bar component, popup, discovery, filtering and forwarding implementation; `mod.json` declares the popup size. Add `port-manager` to the desired layout's status bar. No keys file is required.
- The status-bar instance scans and owns forwarding operations; the popup uses shared state and sends it commands. Herdr APIs include `spaces`, `panes`, `terminals`, `machines`, `exec`, `hc`, shared state and `openOverlay`.
- Discovery runs system utilities including `lsof`, `ss`, `ps`, `git` and `readlink` where available, locally or on a space's machine. Forwarding runs SSH through Herdr terminals. It accesses process and working-directory information outside the mod directory and uses network connections for remote scanning and SSH forwarding.
- Icons are Lucide (ISC); the bundled RE2JS library is MIT licensed. Their license texts are alongside the bundled files.

## Watch out

- This is experimental. Availability of listeners, process names and PIDs depends on operating system tools and permissions. A ready machine is not the same as every configured machine; the optional scan does not initiate a connection to a dormant machine.
- SSH authentication must work non-interactively. The advanced socket setting is available if Herdr does not inherit an SSH agent. Forwards are local loopback only; this mod does not stop the remote service.
- Only stop operations whose ownership is verified are attempted. Interrupted or unverifiable forwards may require manual investigation. Identity checks cannot eliminate every race.
- RE2 syntax intentionally excludes lookaround and backreferences. Sidebar integration is not implemented. The fixed popup size does not dynamically resize to its contents.
- Installing the files alone does not add the status-bar entry: the user's layout must contain the mod. Do not overwrite an existing mod or layout without permission.

## Done when

- `npm test` at the repository root passes.
- After installing the mod and placing it in a layout, `herdr-app check mods/port-manager` succeeds and the status-bar entry opens the popup.
- In Herdr, verify space and other listener groups, filters and settings against real processes. On a suitable remote machine, verify forward, edit, open and stop separately. Automated host tests and `herdr-app check` do not prove these interactive or remote behaviors.
