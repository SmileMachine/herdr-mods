import { parseLsof, parseSs, classifyProcess, classifyCwd } from './model.js';

export function parseProcesses(text) {
  const parents = new Map(), ttys = new Set();
  for (const line of text.split(/\r?\n/)) {
    const m = line.trim().match(/^(\d+)\s+(\d+)\s+(\S+)$/);
    if (!m) continue;
    const pid = Number(m[1]); parents.set(pid, Number(m[2]));
    if (!/^\?+$/.test(m[3])) ttys.add(pid);
  }
  return { parents, ttys };
}

export function mergeMachineSnapshots(targets, results, previous, now) {
  return targets.map((machine, i) => {
    const r = results[i];
    if (r.status === 'fulfilled') return { machine, records: r.value, stale: false, error: null, at: now };
    const old = previous.find(x => x.machine === machine);
    return { machine, records: old?.records ?? [], stale: true, error: String(r.reason?.message ?? r.reason), at: old?.at ?? null };
  });
}

// Dependency injection keeps machine errors, fallbacks and classification testable.
export async function scanMachine(machine, adapter, context) {
  const opts = { on: machine, timeout: 10000 };
  let listeners, lsof;
  try { lsof = await adapter.exec('lsof', ['-nP','-iTCP','-sTCP:LISTEN','-F','pcn'], opts); } catch {}
  if (lsof?.code === 0 || (lsof?.code === 1 && !lsof.stdout && !lsof.stderr)) listeners = parseLsof(lsof.stdout);
  else {
    let ss;
    try { ss = await adapter.exec('ss', ['-ltnpH'], opts); } catch (e) { throw new Error(`Listener scan failed: ${e.message ?? e}`); }
    if (ss.code !== 0) throw new Error(`Listener scan failed: ${ss.stderr || lsof?.stderr || 'lsof and ss unavailable'}`);
    listeners = parseSs(ss.stdout);
  }
  let processInfo = { parents: new Map(), ttys: new Set() }, complete = false;
  try {
    const ps = await adapter.exec('ps', ['-eo','pid=,ppid=,tty='], opts);
    if (ps.code === 0) { processInfo = parseProcesses(ps.stdout); complete = true; }
  } catch {}
  const shells = await context.shells(machine);
  const candidates = await context.candidates(machine);
  const records = [];
  for (const listener of listeners) {
    const proc = classifyProcess(listener.pid, processInfo.parents, processInfo.ttys, shells, complete);
    let cwd = null;
    if (listener.pid) {
      try { cwd = await context.cwd(machine, listener.pid); } catch {}
    }
    const byCwd = classifyCwd(cwd, candidates);
    records.push({ ...listener, machine, terminal: proc.terminal, processSpace: proc.space, cwdSpace: byCwd.space, cwdCandidates: byCwd.candidates, cwdReason: byCwd.reason });
  }
  return records;
}
