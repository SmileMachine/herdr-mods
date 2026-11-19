// Pure validation and planning for manually requested SSH forwards.
// This module never starts or stops processes.
export const FORWARD_LABEL = 'port-manager.forward.v1';

export function parsePort(value) {
  const text = String(value).trim();
  if (!/^\d+$/.test(text)) throw new Error('Enter a port from 1–65535.');
  const port = Number(text);
  if (port < 1 || port > 65535) throw new Error('Enter a port from 1–65535.');
  return port;
}

export function remoteHost(host) {
  // Wildcard listeners are reachable through the corresponding loopback.
  if (host === '*' || host === '0.0.0.0') return '127.0.0.1';
  if (host === '[::]' || host === '::') return '::1';
  const value = host?.startsWith('[') && host.endsWith(']') ? host.slice(1,-1) : host;
  // IPv4 and IPv6 only. Reject zone IDs, names and malformed/injectable values.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(value ?? '') && value.split('.').every(x => Number(x) <= 255)) return value;
  if (/^[0-9a-fA-F:]+$/.test(value ?? '') && value.includes(':') && !value.includes(':::')) return value;
  throw new Error('This listener address cannot be forwarded safely.');
}

export function planForward({machine, host, remotePort, localPort}, machines, token) {
  if (!machine || typeof machine !== 'string') throw new Error('Select a remote machine.');
  const targetMachine = machines.find(m => m.name === machine);
  if (!targetMachine || targetMachine.via || typeof targetMachine.target !== 'string' || !targetMachine.target || targetMachine.target.startsWith('-') || /[\s\x00-\x1f]/.test(targetMachine.target))
    throw new Error('This machine does not have a supported SSH target.');
  if (!/^[a-f0-9]{32}$/.test(token ?? '')) throw new Error('Invalid forward identity.');
  const local = parsePort(localPort), remote = parsePort(remotePort), destination = remoteHost(host);
  const metadata = {v:1, token, machine, host, remote, local};
  const dest = destination.includes(':') ? `[${destination}]` : destination;
  return {metadata, label:`${FORWARD_LABEL}=${encodeURIComponent(JSON.stringify(metadata))}`, command:'ssh',
    args:['-N','-o','ControlMaster=no','-o','ControlPath=none','-o','ExitOnForwardFailure=yes','-o','ServerAliveInterval=15','-L',`127.0.0.1:${local}:${dest}:${remote}`,targetMachine.target]};
}

export function parseForwardLabel(value) {
  try {
    const m = JSON.parse(decodeURIComponent(value));
    if (m.v !== 1 || !/^[a-f0-9]{32}$/.test(m.token) || typeof m.machine !== 'string' || !m.machine || typeof m.host !== 'string') return null;
    if (parsePort(m.remote) !== m.remote || parsePort(m.local) !== m.local) return null;
    remoteHost(m.host);
    return {v:1,token:m.token,machine:m.machine,host:m.host,remote:m.remote,local:m.local};
  } catch { return null; }
}
