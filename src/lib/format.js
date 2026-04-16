export function fmtCurrency(value, currency = 'GBP') {
  if (value == null || isNaN(value)) return '—';
  const code = (currency || 'GBP').toUpperCase();
  try {
    return new Intl.NumberFormat(localeForCurrency(code), {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${code} ${Number(value).toFixed(2)}`;
  }
}

function localeForCurrency(code) {
  switch (code) {
    case 'NOK':
    case 'SEK':
    case 'DKK':
      return 'nb-NO';
    case 'EUR':
      return 'de-DE';
    case 'USD':
      return 'en-US';
    case 'GBP':
    default:
      return 'en-GB';
  }
}

// Extract the statement currency from the first reservation / listing that declares one.
export function detectCurrency(statementOrData) {
  const d = statementOrData || {};
  const reservations = d.reservations || [];
  for (const r of reservations) {
    const c = r?.money?.currency || r?.currency;
    if (c) return c;
  }
  const listings = d.listings || [];
  for (const l of listings) {
    const c = l?.prices?.currency || l?.currency;
    if (c) return c;
  }
  if (d.publishedStatement?.currency) return d.publishedStatement.currency;
  if (d.owner?.currency) return d.owner.currency;
  return 'NOK';
}

export function fmtDate(d) {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime())) return String(d);
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function fmtShortDate(d) {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime())) return String(d);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

export function monthRange(yyyyMm) {
  const [y, m] = yyyyMm.split('-').map(Number);
  const from = new Date(Date.UTC(y, m - 1, 1));
  const to = new Date(Date.UTC(y, m, 0));
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export function currentMonthYYYYMM() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function offsetMonthYYYYMM(months) {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function rangeOfMonths(backCount) {
  // Returns { from, to } covering the last N full months up to and including last month.
  const end = new Date();
  end.setUTCDate(1);
  end.setUTCDate(0); // last day of previous month
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - (backCount - 1), 1));
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  };
}

export function labelForYYYYMM(yyyyMm) {
  const [y, m] = yyyyMm.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}
