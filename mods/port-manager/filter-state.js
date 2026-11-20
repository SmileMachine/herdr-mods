import {compileNamePattern, parsePortRanges} from './model.js';

// Validate each draft independently so an invalid field never blocks another one.
export function validateDrafts(name, ports, nameMode) {
  const errors = {};
  try { compileNamePattern(name, nameMode); } catch { errors.name = 'Enter a valid RE2 expression (lookaround and backreferences are not supported).'; }
  try { parsePortRanges(ports); } catch { errors.ports = 'Use ports from 1–65535, for example 3000, 8000-8999.'; }
  return errors;
}
export function applyDrafts(saved, name, ports) {
  const errors = validateDrafts(name, ports, saved.nameMode);
  return {errors, next:{...saved, name:errors.name ? saved.name : name, ports:errors.ports ? saved.ports : ports}};
}
