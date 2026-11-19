import {parsePort} from './forward-plan.js';

// SSH forwards bind explicitly to IPv4 loopback; local services use localhost.
export function browserUrl(port, forwarded=false) {
  try {
    return `http://${forwarded?'127.0.0.1':'localhost'}:${parsePort(port)}`;
  } catch {
    return null;
  }
}
