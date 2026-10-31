import { DEFAULT_PREFERENCES, DEFAULT_TRACE_PARAMS, sanitizePreferences, sanitizeTraceParams } from '../trace/settings';
import type { Preferences, TraceParams } from '../trace/types';

const PARAMS_KEY = 'kontur.params.v1';
const PREFS_KEY = 'kontur.prefs.v1';

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be unavailable (private mode, quota). Preferences are not
    // critical to the workflow, so the app keeps working in memory.
  }
}

export function readStoredParams(): TraceParams {
  const stored = readJson(PARAMS_KEY);
  return stored === null ? { ...DEFAULT_TRACE_PARAMS } : sanitizeTraceParams(stored);
}

export function writeStoredParams(params: TraceParams): void {
  writeJson(PARAMS_KEY, params);
}

export function readStoredPreferences(): Preferences {
  const stored = readJson(PREFS_KEY);
  return stored === null ? { ...DEFAULT_PREFERENCES } : sanitizePreferences(stored);
}

export function writeStoredPreferences(preferences: Preferences): void {
  writeJson(PREFS_KEY, preferences);
}

export function clearStoredSettings(): void {
  try {
    localStorage.removeItem(PARAMS_KEY);
    localStorage.removeItem(PREFS_KEY);
  } catch {
    // ignore
  }
}
