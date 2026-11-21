// Usernames ("handles"): unique, lowercase, 3–20 characters of a–z, 0–9 and _.
// The database must enforce the same rule (a check constraint plus a unique index on profiles.handle).

export const HANDLE_MIN = 3;
export const HANDLE_MAX = 20;
const HANDLE_PATTERN = /^[a-z0-9_]{3,20}$/;

/** What the user typed, made into a candidate handle: drops a leading @, lowercases, trims. */
export function normalizeHandle(input: string): string {
  return input.trim().replace(/^@/, '').toLowerCase();
}

export function isValidHandle(handle: string): boolean {
  return HANDLE_PATTERN.test(handle);
}

/** A message explaining why the handle is invalid, or null if it's fine. */
export function handleProblem(handle: string): string | null {
  if (handle.length < HANDLE_MIN) return `At least ${HANDLE_MIN} characters`;
  if (handle.length > HANDLE_MAX) return `At most ${HANDLE_MAX} characters`;
  if (!isValidHandle(handle)) return 'Only lowercase letters, numbers and _';
  return null;
}
