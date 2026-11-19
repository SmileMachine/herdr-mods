import {FORWARD_LABEL, parseForwardLabel} from './forward-plan.js';

// A label or a listening port alone is not evidence of ownership. Callers must
// gather a fresh local process table and listener PIDs before starting/stopping.
export function inspectForward(terminal, processTable, listeners) {
  const meta = parseForwardLabel(terminal?.labels?.[FORWARD_LABEL]);
  if (!meta || typeof terminal.address !== 'string' || terminal.address.includes('/') || terminal.state !== 'live') return null;
  const root = Number(terminal.pid);
  if (!Number.isSafeInteger(root) || root < 2) return {meta, address:terminal.address, state:'unknown'};
  const candidates = listeners.filter(x => x.port === meta.local && x.host === '127.0.0.1');
  for (const socket of candidates) {
    let pid = Number(socket.pid), steps = 0;
    const owner = processTable.get(pid);
    // Exact executable identity must be obtained independently, not from a label.
    if (!owner || owner.name !== 'ssh') continue;
    while (pid > 1 && steps++ < 128) {
      if (pid === root) return {meta,address:terminal.address,state:'verified',pid:Number(socket.pid)};
      const p = processTable.get(pid);
      if (!p || p.ppid === pid) break;
      pid = p.ppid;
    }
  }
  return {meta,address:terminal.address,state:'unknown'};
}
