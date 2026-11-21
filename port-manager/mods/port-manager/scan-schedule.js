export const DEFAULT_SCAN_SECONDS = 5;
export function scanIntervalMs(seconds) {
  return [5, 10, 30, 60].includes(seconds) ? seconds * 1000 : DEFAULT_SCAN_SECONDS * 1000;
}
export function scanDue(now, lastStarted, seconds) {
  return lastStarted == null || now < lastStarted || now - lastStarted >= scanIntervalMs(seconds);
}
