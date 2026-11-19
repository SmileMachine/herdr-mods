// Match discovered listeners to managed forwards without depending on how the
// platform spells wildcard bind addresses in lsof output.
function hostAliases(host) {
  if (host === '*' || host === '0.0.0.0') return new Set(['*', '0.0.0.0']);
  if (host === '[::]' || host === '::') return new Set(['[::]', '::']);
  return new Set([host]);
}

export function matchesForwardListener(record, metadata) {
  if (!record || !metadata || record.machine !== metadata.machine || record.port !== metadata.remote) return false;
  const recordHosts = hostAliases(record.host), metadataHosts = hostAliases(metadata.host);
  return [...recordHosts].some(host => metadataHosts.has(host));
}

export function managedForwardFor(record, entries) {
  const exact = entries.find(entry => entry?.metadata?.machine === record?.machine &&
    entry.metadata.host === record.host && entry.metadata.remote === record.port);
  return exact ?? entries.find(entry => matchesForwardListener(record, entry?.metadata));
}
