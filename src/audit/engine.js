import { RULES } from './rules.js';

// Run all audit rules against a fully assembled "statement" object.
// Statement shape:
// {
//   period: { from, to },
//   owner, listings, reservations, expenses,
//   payout, income, openingBalance, priorClosingBalance, priorAvgPayout,
//   maintenanceTickets, expectedVendorInvoiceMissing,
// }
//
// Returns an annotated structure: per-reservation, per-line-item, per-statement findings.
export function runAudit(statement) {
  const findings = {
    statement: [],
    reservations: {}, // reservationId -> Finding[]
    lineItems: {}, // lineItemId -> Finding[]
  };

  const push = (bucket, key, finding) => {
    if (!key) {
      bucket.push(finding);
      return;
    }
    bucket[key] = bucket[key] || [];
    bucket[key].push(finding);
  };

  for (const rule of RULES) {
    try {
      if (rule.appliesTo === 'statement') {
        const result = rule.check({ statement, reservations: statement.reservations || [] });
        if (result) {
          push(findings.statement, null, toFinding(rule, result));
        }
      } else if (rule.appliesTo === 'reservation') {
        for (const r of statement.reservations || []) {
          const result = rule.check({ reservation: r, statement });
          if (result) push(findings.reservations, r._id || r.id, toFinding(rule, result));
        }
      } else if (rule.appliesTo === 'lineItem') {
        // Build line items from reservations + expenses
        const items = collectLineItems(statement);
        for (const li of items) {
          const result = rule.check({ lineItem: li, statement });
          if (result) push(findings.lineItems, li.id, toFinding(rule, result));
        }
      }
    } catch (err) {
      // A rule throwing should never crash the audit.
      // eslint-disable-next-line no-console
      console.warn(`[audit] rule ${rule.id} threw:`, err);
    }
  }

  findings.summary = summarize(findings);
  return findings;
}

function toFinding(rule, result) {
  return {
    id: rule.id,
    category: rule.category,
    severity: rule.severity,
    title: rule.title,
    description: rule.description,
    note: typeof result === 'object' && result.note ? result.note : null,
  };
}

function summarize(findings) {
  const counts = { critical: 0, warning: 0, info: 0, total: 0 };
  const all = [
    ...findings.statement,
    ...Object.values(findings.reservations).flat(),
    ...Object.values(findings.lineItems).flat(),
  ];
  for (const f of all) {
    counts[f.severity] = (counts[f.severity] || 0) + 1;
    counts.total += 1;
  }
  return counts;
}

export function collectLineItems(statement) {
  const items = [];
  for (const r of statement.reservations || []) {
    const m = r.money || {};
    const base = `${r._id || r.id}`;
    if (m.fareAccommodation) {
      items.push({
        id: `${base}:rent`,
        kind: 'rental',
        listingId: r.listingId,
        amount: m.fareAccommodation,
        title: 'Rental income',
      });
    }
    if (m.fareCleaning) {
      items.push({
        id: `${base}:cleaning`,
        kind: 'cleaning',
        listingId: r.listingId,
        amount: m.fareCleaning,
        title: 'Cleaning fee',
      });
    }
    if (m.commission) {
      items.push({
        id: `${base}:commission`,
        kind: 'commission',
        listingId: r.listingId,
        amount: -Math.abs(m.commission),
        title: 'PMC commission',
      });
    }
    if (m.hostChannelFee) {
      items.push({
        id: `${base}:channel`,
        kind: 'channelFee',
        listingId: r.listingId,
        amount: -Math.abs(m.hostChannelFee),
        title: 'Channel fee',
      });
    }
  }
  for (const e of statement.expenses || []) {
    items.push({
      id: `exp:${e._id || e.id}`,
      kind: 'expense',
      listingId: e.listingId,
      amount: -Math.abs(e.amount || 0),
      title: e.description || e.title || 'Expense',
      receiptUrl: e.receiptUrl,
      vendor: e.vendor,
    });
  }
  return items;
}
