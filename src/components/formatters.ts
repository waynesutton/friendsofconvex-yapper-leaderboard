export function compactNumber(value: number): string {
  if (value < 1_000) return value.toLocaleString("en-US");
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: value >= 1_000_000 ? 1 : 0,
  }).format(value);
}

export function formatSyncTime(timestamp: number | null): string {
  if (timestamp === null) return "Awaiting first sync";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(timestamp);
}

// "8:17 AM PT". Saved rankings follow the board's Pacific schedule.
export function formatPacificTime(timestamp: number): string {
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "numeric",
    minute: "2-digit",
  }).format(timestamp);
  return `${time} PT`;
}

// Short relative freshness label for the board chip: "Updated 2h ago".
export function relativeSyncTime(timestamp: number | null): string {
  if (timestamp === null) return "Awaiting first sync";
  const elapsed = Date.now() - timestamp;
  if (elapsed < 60_000) return "Updated just now";
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 60) return `Updated ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Updated ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `Updated ${days}d ago`;
}

export function initials(value: string): string {
  return value
    .replace(/^@/, "")
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
