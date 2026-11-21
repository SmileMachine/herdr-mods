import {RE2JS} from './vendor/re2js.js';

// Pure discovery, attribution and visibility logic. Machine-scoped IDs are essential:
// PIDs and paths are not globally unique.
export function parseLsof(text) {
  let pid = null, name = null;
  const records = new Map();
  for (const line of text.split(/\r?\n/)) {
    const value = line.slice(1);
    if (line[0] === 'p') { pid = Number(value) || null; name = null; }
    else if (line[0] === 'c') name = value || null;
    else if (line[0] === 'n') {
      const match = value.match(/^(.*):(\d+)$/);
      if (!match || !pid) continue;
      const port = Number(match[2]);
      if (port < 1 || port > 65535) continue;
      const host = match[1];
      records.set(JSON.stringify([pid, host, port]), { pid, name, host, port });
    }
  }
  return [...records.values()];
}

// ss may report a socket without process access. Keep it instead of inventing a PID.
export function parseSs(text) {
  const records = [];
  for (const line of text.split(/\r?\n/)) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 4) continue;
    const match = parts[3].match(/^(.*):(\d+)$/);
    if (!match) continue;
    const port = Number(match[2]);
    if (port < 1 || port > 65535) continue;
    const processes = [...line.matchAll(/\("([^"]+)",pid=(\d+)/g)];
    if (!processes.length) records.push({ host: match[1], port, pid: null, name: null });
    else for (const p of processes) records.push({ host: match[1], port, pid: Number(p[2]), name: p[1] });
  }
  return records;
}

export function classifyProcess(pid, parents, ttys, shells, complete = true) {
  if (!pid || !parents.has(pid)) return { space: null, terminal: 'unknown' };
  const visited = new Set(); let tty = false, current = pid;
  while (current > 1 && !visited.has(current)) {
    visited.add(current);
    if (ttys.has(current)) tty = true;
    if (shells.has(current)) return { space: shells.get(current), terminal: 'yes' };
    if (!parents.has(current)) return { space: null, terminal: tty ? 'yes' : 'unknown' };
    current = parents.get(current);
  }
  return { space: null, terminal: tty ? 'yes' : complete && current <= 1 ? 'no' : 'unknown' };
}

export function classifyCwd(cwd, candidates) {
  if (!cwd) return { space: null, candidates: [], reason: 'unknown' };
  const matches = candidates.filter(({ root }) => root && (cwd === root || cwd.startsWith(root.endsWith('/') ? root : root + '/')));
  if (!matches.length) return { space: null, candidates: [], reason: 'unmatched' };
  const length = Math.max(...matches.map(({ root }) => root.length));
  const ids = [...new Set(matches.filter(({ root }) => root.length === length).map(({ space }) => space))];
  return { space: ids.length === 1 ? ids[0] : null, candidates: ids, reason: ids.length === 1 ? 'matched' : 'ambiguous' };
}

export function parsePortRanges(text) {
  if (!text.trim()) return [];
  return text.split(',').map((part) => {
    const m = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!m) throw new Error('Invalid port or range');
    const lo = Number(m[1]), hi = Number(m[2] ?? m[1]);
    if (lo < 1 || hi > 65535 || lo > hi) throw new Error('Port range must be within 1–65535');
    return [lo, hi];
  });
}

// RE2JS avoids catastrophic backtracking. Patterns use RE2 syntax.
export function compileNamePattern(text, mode = 'text') {
  if (!text) return null;
  if (mode === 'text') { const needle = text.toLowerCase(); return (name) => name.toLowerCase().includes(needle); }
  if (mode !== 'regex') throw new Error('Unknown name mode');
  let re; try { re = RE2JS.compile(text, RE2JS.CASE_INSENSITIVE); } catch { throw new Error('Unsupported or invalid RE2 expression'); }
  return (name) => re.test(name);
}

export function compileFilter(config = {}) {
  let name;
  try { name = compileNamePattern(config.name ?? '', config.nameMode ?? 'text'); } catch { return () => false; }
  const ports = parsePortRanges(config.ports ?? '');
  const nameExclude = config.nameAction === 'exclude', portExclude = config.portAction === 'exclude';
  return (record) => {
    if (name) {
      // Unknown names are retained, including for include filters: they are not silently classified.
      if (record.name != null && (name(record.name) === nameExclude)) return false;
    }
    if (ports.length) {
      const match = ports.some(([lo, hi]) => record.port >= lo && record.port <= hi);
      if (match === portExclude) return false;
    }
    return true;
  };
}
