// Build a presentation model without changing snapshots or their order.
// Space IDs are machine-scoped; stale or missing spaces never become a guess.
export function groupPorts(snapshots, spaces, strategy, filter = () => true) {
  const buckets = spaces.map(space => ({ kind: 'space', space, records: [] }));
  const index = new Map(buckets.map(group => [JSON.stringify([group.space.machine ?? null, group.space.id]), group]));
  const others = new Map();
  const issues = [];
  for (const snapshot of snapshots) {
    const machine = snapshot.machine ?? null;
    if (snapshot.stale) issues.push({machine, error: snapshot.error, at: snapshot.at});
    for (const record of snapshot.records) {
      if (!filter(record)) continue;
      const id = strategy === 'cwd' ? record.cwdSpace : record.processSpace;
      const group = index.get(JSON.stringify([machine, id]));
      const entry = {record, stale: snapshot.stale};
      if (group && !(strategy === 'cwd' && record.cwdReason === 'ambiguous')) {
        group.records.push(entry);
      } else {
        const category = strategy === 'cwd' && record.cwdReason === 'ambiguous' ? 'ambiguous' :
          record.terminal === 'yes' ? 'terminal' : record.terminal === 'no' ? 'process' : 'unknown';
        const key = JSON.stringify([machine, category]);
        if (!others.has(key)) others.set(key, {kind:'other', machine, category, records:[]});
        others.get(key).records.push(entry);
      }
    }
  }
  // Stable category ordering is independent of scan/listener enumeration.
  const order = {terminal: 0, ambiguous: 1, unknown: 2, process: 3};
  const otherGroups = [...others.values()].sort((a, b) => order[a.category] - order[b.category]);
  return {spaceGroups: buckets.filter(g => g.records.length), otherGroups, issues};
}
