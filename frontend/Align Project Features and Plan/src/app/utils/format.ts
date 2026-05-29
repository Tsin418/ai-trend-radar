export const fmtNum = (n: number | null | undefined): string => {
  if (n == null) return '—';
  if (Math.abs(n) >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k';
  return n.toString();
};

export const fmtDelta = (n: number | null | undefined, fallback = 'Not enough data'): string => {
  if (n == null) return fallback;
  const sign = n > 0 ? '+' : '';
  return `${sign}${fmtNum(n)}`;
};

export const fmtRate = (r: number | null | undefined): string => {
  if (r == null) return '—';
  const sign = r > 0 ? '+' : '';
  return `${sign}${r.toFixed(2)}%`;
};

export const fmtDate = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toISOString().slice(0, 10);
  } catch {
    return '—';
  }
};

export const fmtDateTime = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false
    }).format(d).replace(/(\d+)\/(\d+)\/(\d+),\s+(.*)/, '$3-$1-$2 $4');
  } catch {
    return '—';
  }
};

export const fmtRelative = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const now = Date.now();
  const t = new Date(iso).getTime();
  const diff = (now - t) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return fmtDate(iso);
};
