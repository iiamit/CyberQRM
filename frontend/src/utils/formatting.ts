/** Format a number as USD currency */
export function formatCurrency(value: number | undefined | null, compact = false): string {
  if (value == null || isNaN(value)) return '$—';
  if (compact) {
    if (Math.abs(value) >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
    if (Math.abs(value) >= 1_000_000)     return `$${(value / 1_000_000).toFixed(1)}M`;
    if (Math.abs(value) >= 1_000)         return `$${(value / 1_000).toFixed(0)}K`;
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

/** Format a probability (0–1) as percentage */
export function formatPercent(value: number | undefined | null, decimals = 1): string {
  if (value == null || isNaN(value)) return '—%';
  return `${(value * 100).toFixed(decimals)}%`;
}

/** Format a plain percentage number */
export function formatPct(value: number | undefined | null, decimals = 1): string {
  if (value == null || isNaN(value)) return '—%';
  return `${value.toFixed(decimals)}%`;
}

/** Risk priority color classes */
export function riskColor(priority: string): string {
  switch (priority) {
    case 'critical': return 'text-red-600';
    case 'high':     return 'text-orange-600';
    case 'medium':   return 'text-yellow-600';
    case 'low':      return 'text-green-600';
    default:         return 'text-gray-600';
  }
}

export function riskBadgeClass(priority: string): string {
  switch (priority) {
    case 'critical': return 'badge-red';
    case 'high':     return 'badge-orange';
    case 'medium':   return 'badge-yellow';
    case 'low':      return 'badge-green';
    default:         return 'badge-gray';
  }
}

export function statusBadgeClass(status: string): string {
  switch (status) {
    case 'active':   return 'badge-green';
    case 'draft':    return 'badge-gray';
    case 'archived': return 'badge-yellow';
    default:         return 'badge-gray';
  }
}

export function aleToRiskPriority(ale: number, maxAle: number): string {
  if (maxAle === 0) return 'low';
  const pct = ale / maxAle;
  if (pct > 0.5) return 'critical';
  if (pct > 0.25) return 'high';
  if (pct > 0.1) return 'medium';
  return 'low';
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-US').format(Math.round(n));
}
