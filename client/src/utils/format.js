const DAY = 24 * 60 * 60 * 1000;

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/**
 * Group conversations (already sorted newest first) into sidebar buckets.
 * @returns {Array<{ label: string, items: object[] }>}
 */
export const groupByRecency = (conversations, now = new Date()) => {
  const today = startOfDay(now);
  const buckets = [
    { label: 'Today', from: today },
    { label: 'Yesterday', from: today - DAY },
    { label: 'Previous 7 days', from: today - 7 * DAY },
    { label: 'Previous 30 days', from: today - 30 * DAY },
    { label: 'Older', from: -Infinity }
  ].map((b) => ({ ...b, items: [] }));

  for (const conversation of conversations) {
    const time = new Date(conversation.updatedAt || conversation.createdAt).getTime();
    buckets.find((b) => time >= b.from).items.push(conversation);
  }
  return buckets.filter((b) => b.items.length > 0);
};

export const formatTime = (iso) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';

export const greeting = (date = new Date()) => {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

export const displayName = (user) => user?.name?.split(' ')[0] || user?.email?.split('@')[0] || 'there';

export const initials = (user) => {
  const source = user?.name || user?.email || '?';
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] || '') + (user?.name ? parts[1]?.[0] || '' : '')).toUpperCase() || '?';
};
