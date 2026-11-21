const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "Active now", "Active 5m ago", "Active 3h ago", "Active 2d ago", then a date. */
export function lastActiveLabel(iso: string | null, now = Date.now()): string {
  if (!iso) return 'Not active yet';
  const diff = now - new Date(iso).getTime();
  if (diff < 5 * MINUTE) return 'Active now';
  if (diff < HOUR) return `Active ${Math.floor(diff / MINUTE)}m ago`;
  if (diff < DAY) return `Active ${Math.floor(diff / HOUR)}h ago`;
  if (diff < 7 * DAY) return `Active ${Math.floor(diff / DAY)}d ago`;
  return `Active ${formatDate(iso)}`;
}

/** Whether to show the green "online" dot next to the last-active label. */
export function isActiveNow(iso: string | null, now = Date.now()): boolean {
  return !!iso && now - new Date(iso).getTime() < 5 * MINUTE;
}

/** "Nov 8, 2026" */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
