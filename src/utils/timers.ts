export function formatRelativeTime(value: Date | null): string {
  if (!value) {
    return "never";
  }
  const diffMs = Date.now() - value.getTime();
  if (diffMs < 1000) {
    return "just now";
  }
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) {
    return `${seconds}s ago`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export function shortDateTime(date: Date): string {
  return date.toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Compact relative time for the PR list — e.g. "<1m", "3m", "2h", "24h",
 * "2d 4h", "2w".  No "ago" suffix.
 */
export function compactRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return "<1m";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  if (days < 7) {
    const remainingHours = hours % 24;
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
  }

  const weeks = Math.floor(days / 7);
  return `${weeks}w`;
}
