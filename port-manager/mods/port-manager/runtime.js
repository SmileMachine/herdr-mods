import { exec, hc, spaces, panes, terminals, machines } from 'herdr';
import { scanMachine, mergeMachineSnapshots, mapLimit } from './discovery.js';

const machineOf = (address) => address?.includes('/') ? address.split('/')[0] : null;
async function shellMap(machine) {
  const map = new Map();
  for (const term of terminals()) {
    if (machineOf(term.address) !== machine || term.state !== 'live' || !term.labels?.['herdr.space']) continue;
    let pid = term.pid;
    if (!pid) {
      try { const r = await hc(['get', term.address, '--json']); if (r.code === 0) pid = JSON.parse(r.stdout).pid; } catch {}
    }
    if (pid) map.set(Number(pid), machine ? `${machine}/${term.labels['herdr.space']}` : term.labels['herdr.space']);
  }
  return map;
}
async function roots(machine) {
  const all = spaces().filter(s => (s.machine ?? null) === machine), pp = panes();
  const result = [];
  for (const s of all) {
    const ids = new Set(s.tabs.map(t => t.id));
    const dirs = new Set([s.folder, ...pp.filter(p => ids.has(p.tab)).map(p => p.cwd)]);
    for (const dir of dirs) {
      if (!dir) continue;
      try {
        const r = await exec('git', ['rev-parse','--show-toplevel'], {cwd: dir, on: machine, timeout: 10000});
        if (r.code === 0 && r.stdout.trim()) result.push({space:s.id, root:r.stdout.trim()});
      } catch {}
    }
  }
  return result;
}
async function cwd(machine, pid) {
  const opts = {on:machine,timeout:10000};
  try {
    const r=await exec('lsof',['-a','-d','cwd','-Fn','-p',String(pid)],opts);
    const line=r.stdout.split('\n').find(x=>x.startsWith('n'));
    if (r.code===0 && line) return line.slice(1);
  } catch {}
  try { const r=await exec('readlink',[`/proc/${pid}/cwd`],opts); return r.code===0 ? r.stdout.trim() : null; } catch { return null; }
}
export async function scanAll(previous, includeUnattached) {
  const targets = new Set([null, ...spaces().map(s=>s.machine).filter(Boolean)]);
  // machines() reports only live connections. Never connect a dormant machine implicitly.
  if (includeUnattached) for (const m of machines()) if (m.name && m.layout === 'ready') targets.add(m.name);
  const list=[...targets];
  const results=await mapLimit(list, 2, async m => {
    try { return {status:'fulfilled', value:await scanMachine(m,{exec},{shells:shellMap,candidates:roots,cwd})}; }
    catch (reason) { return {status:'rejected', reason}; }
  });
  return mergeMachineSnapshots(list,results,previous,Date.now());
}
