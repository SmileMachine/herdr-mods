# Herdr Port Manager

Experimental Herdr mod for inspecting TCP listeners in one place. The preview can scan the local computer and machines with open spaces, show attributed listeners first in Space order, followed by other listeners grouped by machine and attribution, show process details, switch between process-tree and working-directory attribution, and filter the visible list by process name or port. Regex filters use JavaScript regular expressions. Unknown process names or terminal status remain visible when those filters are active.

The ready-machines option is experimental: it only includes machines already reported as ready by Herdr, not all configured machines without spaces. SSH forwarding, sidebar integration, adjustable refresh intervals and full machine enumeration are not implemented yet. This preview does not create or stop forwards or processes.

Run `npm test` for the host-side tests. Run `herdr-app check mods/port-manager` for initial mod rendering; it does not validate later interaction or remote operation. Installation and actual GUI acceptance are separate steps.
