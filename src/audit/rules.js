// LEV Owner Portal Defect Detection Checklist — 35 rules / 8 categories.
// Severity: 'critical' (immediate finance impact), 'warning' (likely defect),
// 'info' (worth a human look).
//
// Each rule has:
//   id, category, severity, title, description
//   appliesTo: 'reservation' | 'lineItem' | 'statement'
//   check(ctx) -> boolean | { pass: false, note?: string }

export const CATEGORIES = {
  BAL: { code: 'BAL', label: 'Statement Balance', icon: 'balance' },
  OWN: { code: 'OWN', label: 'Owner Stay', icon: 'home' },
  CXL: { code: 'CXL', label: 'Cancelled Booking', icon: 'cancel' },
  PAY: { code: 'PAY', label: 'Payment / Cash', icon: 'cash' },
  EXP: { code: 'EXP', label: 'Maintenance / Expenses', icon: 'wrench' },
  PRP: { code: 'PRP', label: 'Property Assignment', icon: 'tag' },
  CLI: { code: 'CLI', label: 'Client / Contract', icon: 'user' },
  CMM: { code: 'CMM', label: 'Commission / Fees', icon: 'percent' },
};

const isOwnerStay = (r) => {
  const src = (r.source || '').toLowerCase();
  const channel = (r.channel || '').toLowerCase();
  const status = (r.status || '').toLowerCase();
  return (
    status === 'owner stay' ||
    src.includes('owner') ||
    channel.includes('owner') ||
    r.isOwnerStay === true
  );
};

const isCancelled = (r) => {
  const s = (r.status || '').toLowerCase();
  return s === 'canceled' || s === 'cancelled' || Boolean(r.cancelledAt);
};

const money = (r) => r?.money || {};
const num = (v) => (typeof v === 'number' && !isNaN(v) ? v : 0);

export const RULES = [
  // ─────────── STATEMENT BALANCE (5) ───────────
  {
    id: 'BAL-01',
    category: 'BAL',
    severity: 'critical',
    title: 'Negative payout',
    description: 'Statement Balance < 0 — owner would be charged.',
    appliesTo: 'statement',
    check: ({ statement }) => num(statement.payout) < 0,
  },
  {
    id: 'BAL-02',
    category: 'BAL',
    severity: 'warning',
    title: 'Zero payout with active reservations',
    description: 'Balance = 0 but reservations exist in period.',
    appliesTo: 'statement',
    check: ({ statement, reservations }) =>
      num(statement.payout) === 0 && reservations.some((r) => !isCancelled(r)),
  },
  {
    id: 'BAL-03',
    category: 'BAL',
    severity: 'warning',
    title: 'Unusually low payout',
    description: 'Payout >50% below prior-month average.',
    appliesTo: 'statement',
    check: ({ statement }) => {
      const avg = statement.priorAvgPayout;
      if (!avg || avg <= 0) return false;
      return statement.payout < avg * 0.5;
    },
  },
  {
    id: 'BAL-04',
    category: 'BAL',
    severity: 'info',
    title: 'Unusually high payout',
    description: 'Payout >100% above prior-month average.',
    appliesTo: 'statement',
    check: ({ statement }) => {
      const avg = statement.priorAvgPayout;
      if (!avg || avg <= 0) return false;
      return statement.payout > avg * 2;
    },
  },
  {
    id: 'BAL-05',
    category: 'BAL',
    severity: 'warning',
    title: 'Empty statement with active period',
    description: 'Statement is fully zero with no reservations.',
    appliesTo: 'statement',
    check: ({ statement, reservations }) =>
      num(statement.payout) === 0 &&
      num(statement.income) === 0 &&
      reservations.length === 0,
  },

  // ─────────── OWNER STAY (5) ───────────
  {
    id: 'OWN-01',
    category: 'OWN',
    severity: 'critical',
    title: 'Cleaning fee on owner stay',
    description: 'Owner-stay reservations should never carry a cleaning fee.',
    appliesTo: 'reservation',
    check: ({ reservation }) =>
      isOwnerStay(reservation) && num(money(reservation).fareCleaning) > 0,
  },
  {
    id: 'OWN-02',
    category: 'OWN',
    severity: 'warning',
    title: 'Linen / Guest Essentials on owner stay',
    description: 'Linen and GE charges should be removed for owner stays.',
    appliesTo: 'reservation',
    check: ({ reservation }) => {
      if (!isOwnerStay(reservation)) return false;
      const items = reservation.invoiceItems || money(reservation).invoiceItems || [];
      return items.some((it) =>
        /linen|guest essential|consumable/i.test(it.title || it.description || '')
      );
    },
  },
  {
    id: 'OWN-03',
    category: 'OWN',
    severity: 'critical',
    title: 'PMC commission on owner stay',
    description: 'Commission must be 0 for owner stays.',
    appliesTo: 'reservation',
    check: ({ reservation }) =>
      isOwnerStay(reservation) && num(money(reservation).commission) > 0,
  },
  {
    id: 'OWN-04',
    category: 'OWN',
    severity: 'warning',
    title: 'Owner stay with channel fees',
    description: 'Channel commission applied to owner-stay booking.',
    appliesTo: 'reservation',
    check: ({ reservation }) =>
      isOwnerStay(reservation) && num(money(reservation).hostChannelFee) > 0,
  },
  {
    id: 'OWN-05',
    category: 'OWN',
    severity: 'info',
    title: 'Owner stay nightly rate populated',
    description: 'Rental income > 0 on an owner stay; usually should be zero.',
    appliesTo: 'reservation',
    check: ({ reservation }) =>
      isOwnerStay(reservation) && num(money(reservation).fareAccommodation) > 0,
  },

  // ─────────── CANCELLED BOOKING (4) ───────────
  {
    id: 'CXL-01',
    category: 'CXL',
    severity: 'critical',
    title: 'Cleaning fee on cancelled booking',
    description: 'Cleaning was billed even though the booking was cancelled.',
    appliesTo: 'reservation',
    check: ({ reservation }) =>
      isCancelled(reservation) && num(money(reservation).fareCleaning) > 0,
  },
  {
    id: 'CXL-02',
    category: 'CXL',
    severity: 'critical',
    title: 'Cancelled revenue counted in payout',
    description: 'Cancelled booking has rental income > 0 contributing to payout.',
    appliesTo: 'reservation',
    check: ({ reservation }) =>
      isCancelled(reservation) && num(money(reservation).fareAccommodation) > 0,
  },
  {
    id: 'CXL-03',
    category: 'CXL',
    severity: 'warning',
    title: 'Cancelled booking — non-refundable handling missing',
    description: 'Cancellation policy was non-refundable yet net payout = 0.',
    appliesTo: 'reservation',
    check: ({ reservation }) =>
      isCancelled(reservation) &&
      /non[- ]?refundable/i.test(reservation?.terms?.cancellation || '') &&
      num(money(reservation).netIncome) === 0,
  },
  {
    id: 'CXL-04',
    category: 'CXL',
    severity: 'warning',
    title: 'Cancelled booking still carrying commission',
    description: 'Commission line remains on a cancelled booking.',
    appliesTo: 'reservation',
    check: ({ reservation }) =>
      isCancelled(reservation) && num(money(reservation).commission) > 0,
  },

  // ─────────── PAYMENT / CASH (4) ───────────
  {
    id: 'PAY-01',
    category: 'PAY',
    severity: 'critical',
    title: 'Cash booking still in bank payout',
    description:
      'Reservation paid in cash to host but rental income still feeds into the bank-payout total.',
    appliesTo: 'reservation',
    check: ({ reservation }) => {
      const m = money(reservation);
      const payments = m.payments || reservation.payments || [];
      const cashPaid = payments.some((p) => /cash/i.test(p.paymentMethod || p.method || ''));
      return cashPaid && num(m.netIncome) > 0;
    },
  },
  {
    id: 'PAY-02',
    category: 'PAY',
    severity: 'warning',
    title: 'Payment received not equal to fare total',
    description: 'paid !== fareAccommodation + fareCleaning + extras.',
    appliesTo: 'reservation',
    check: ({ reservation }) => {
      const m = money(reservation);
      const total =
        num(m.fareAccommodation) + num(m.fareCleaning) + num(m.extras) + num(m.taxes);
      const paid = num(m.totalPaid);
      if (!total) return false;
      return Math.abs(total - paid) > 1;
    },
  },
  {
    id: 'PAY-03',
    category: 'PAY',
    severity: 'warning',
    title: 'Refund recorded but payout unchanged',
    description: 'Refund > 0 but netIncome did not adjust downward.',
    appliesTo: 'reservation',
    check: ({ reservation }) => {
      const m = money(reservation);
      return num(m.refund) > 0 && num(m.netIncome) >= num(m.fareAccommodation);
    },
  },
  {
    id: 'PAY-04',
    category: 'PAY',
    severity: 'info',
    title: 'Manual payment without reference',
    description: 'Payment method is "manual" with no transaction reference.',
    appliesTo: 'reservation',
    check: ({ reservation }) => {
      const payments = money(reservation).payments || reservation.payments || [];
      return payments.some(
        (p) => /manual/i.test(p.paymentMethod || p.method || '') && !p.transactionId
      );
    },
  },

  // ─────────── MAINTENANCE / EXPENSES (4) ───────────
  {
    id: 'EXP-01',
    category: 'EXP',
    severity: 'critical',
    title: 'Maintenance ticket without OS line',
    description: 'A maintenance task exists in the period without a matching expense line.',
    appliesTo: 'statement',
    check: ({ statement }) => {
      const tickets = statement.maintenanceTickets || [];
      const expenses = statement.expenses || [];
      if (!tickets.length) return false;
      return tickets.some(
        (t) =>
          (t.cost || 0) > 0 &&
          !expenses.some((e) => e.linkedTicketId === t._id || e.referenceId === t._id)
      );
    },
  },
  {
    id: 'EXP-02',
    category: 'EXP',
    severity: 'warning',
    title: 'External vendor invoice missing',
    description: 'Vendor invoice expected for property in period but absent from OS.',
    appliesTo: 'statement',
    check: ({ statement }) => Boolean(statement.expectedVendorInvoiceMissing),
  },
  {
    id: 'EXP-03',
    category: 'EXP',
    severity: 'info',
    title: 'Expense without receipt attached',
    description: 'Expense line has no receipt/attachment.',
    appliesTo: 'lineItem',
    check: ({ lineItem }) =>
      lineItem.kind === 'expense' && !lineItem.receiptUrl && num(lineItem.amount) !== 0,
  },
  {
    id: 'EXP-04',
    category: 'EXP',
    severity: 'warning',
    title: 'Duplicate expense suspected',
    description: 'Same vendor + amount + date appears more than once.',
    appliesTo: 'statement',
    check: ({ statement }) => {
      const exps = statement.expenses || [];
      const seen = new Map();
      for (const e of exps) {
        const key = `${e.vendor || ''}|${num(e.amount)}|${e.date || ''}`;
        if (seen.has(key)) return true;
        seen.set(key, true);
      }
      return false;
    },
  },

  // ─────────── PROPERTY ASSIGNMENT (3) ───────────
  {
    id: 'PRP-01',
    category: 'PRP',
    severity: 'critical',
    title: 'Line item on wrong property',
    description: 'Line item listingId does not match any of the owner\'s listings.',
    appliesTo: 'lineItem',
    check: ({ lineItem, statement }) => {
      if (!lineItem.listingId) return false;
      const owned = (statement.listings || []).map((l) => l._id || l.id);
      return !owned.includes(lineItem.listingId);
    },
  },
  {
    id: 'PRP-02',
    category: 'PRP',
    severity: 'warning',
    title: 'Reservation listing renamed mid-period',
    description: 'Reservation references a listing title that no longer matches the listing record.',
    appliesTo: 'reservation',
    check: ({ reservation, statement }) => {
      const found = (statement.listings || []).find(
        (l) => (l._id || l.id) === reservation.listingId
      );
      if (!found) return false;
      const resvTitle = reservation?.listing?.title;
      return resvTitle && found.title && resvTitle !== found.title;
    },
  },
  {
    id: 'PRP-03',
    category: 'PRP',
    severity: 'info',
    title: 'Inactive listing with reservations',
    description: 'Listing flagged inactive in PMS but still receiving bookings.',
    appliesTo: 'reservation',
    check: ({ reservation, statement }) => {
      const found = (statement.listings || []).find(
        (l) => (l._id || l.id) === reservation.listingId
      );
      return found && found?.pms?.active === false;
    },
  },

  // ─────────── CLIENT / CONTRACT (4) ───────────
  {
    id: 'CLI-01',
    category: 'CLI',
    severity: 'critical',
    title: 'Terminated client with payout',
    description: 'Owner contract is terminated/inactive but a payout is being generated.',
    appliesTo: 'statement',
    check: ({ statement }) =>
      ['terminated', 'inactive', 'churned'].includes(
        (statement.owner?.status || '').toLowerCase()
      ) && num(statement.payout) !== 0,
  },
  {
    id: 'CLI-02',
    category: 'CLI',
    severity: 'warning',
    title: 'Initial balance carry-over mismatch',
    description: "This month's opening balance ≠ prior month's closing balance.",
    appliesTo: 'statement',
    check: ({ statement }) => {
      const opening = statement.openingBalance;
      const priorClose = statement.priorClosingBalance;
      if (opening == null || priorClose == null) return false;
      return Math.abs(num(opening) - num(priorClose)) > 1;
    },
  },
  {
    id: 'CLI-03',
    category: 'CLI',
    severity: 'warning',
    title: 'Owner missing bank details',
    description: 'No payout method on file for an owner with a positive payout.',
    appliesTo: 'statement',
    check: ({ statement }) =>
      num(statement.payout) > 0 && !statement.owner?.payoutMethod,
  },
  {
    id: 'CLI-04',
    category: 'CLI',
    severity: 'info',
    title: 'Contract end date passed in period',
    description: 'Contract end date falls inside the statement period.',
    appliesTo: 'statement',
    check: ({ statement }) => {
      const end = statement.owner?.contractEnd;
      if (!end) return false;
      const t = new Date(end).getTime();
      return (
        t >= new Date(statement.period.from).getTime() &&
        t <= new Date(statement.period.to).getTime()
      );
    },
  },

  // ─────────── COMMISSION / FEES (6) ───────────
  {
    id: 'CMM-01',
    category: 'CMM',
    severity: 'warning',
    title: 'Commission rate outside expected band',
    description: 'Effective commission rate < 10% or > 30%.',
    appliesTo: 'reservation',
    check: ({ reservation }) => {
      const m = money(reservation);
      const rev = num(m.fareAccommodation);
      const c = num(m.commission);
      if (rev <= 0 || c <= 0) return false;
      const rate = c / rev;
      return rate < 0.1 || rate > 0.3;
    },
  },
  {
    id: 'CMM-02',
    category: 'CMM',
    severity: 'warning',
    title: 'Cleaning fee differs from listing default',
    description: 'Cleaning fee on this reservation does not match the listing\'s default.',
    appliesTo: 'reservation',
    check: ({ reservation, statement }) => {
      const found = (statement.listings || []).find(
        (l) => (l._id || l.id) === reservation.listingId
      );
      const expected = num(found?.prices?.cleaningFee);
      const actual = num(money(reservation).fareCleaning);
      if (!expected || isOwnerStay(reservation) || isCancelled(reservation)) return false;
      return Math.abs(expected - actual) > 1;
    },
  },
  {
    id: 'CMM-03',
    category: 'CMM',
    severity: 'critical',
    title: 'Negative net income on confirmed booking',
    description: 'Confirmed booking with netIncome < 0 (fees exceed revenue).',
    appliesTo: 'reservation',
    check: ({ reservation }) =>
      !isCancelled(reservation) && num(money(reservation).netIncome) < 0,
  },
  {
    id: 'CMM-04',
    category: 'CMM',
    severity: 'info',
    title: 'Channel fee missing for OTA booking',
    description: 'Booking from Airbnb/Booking.com with no host channel fee recorded.',
    appliesTo: 'reservation',
    check: ({ reservation }) => {
      const ch = (reservation.source || reservation.channel || '').toLowerCase();
      if (!/airbnb|booking|vrbo/.test(ch)) return false;
      return num(money(reservation).hostChannelFee) === 0;
    },
  },
  {
    id: 'CMM-05',
    category: 'CMM',
    severity: 'warning',
    title: 'Tax not collected on taxable booking',
    description: 'Booking has rental income > 0 but taxes = 0.',
    appliesTo: 'reservation',
    check: ({ reservation }) => {
      const m = money(reservation);
      return num(m.fareAccommodation) > 100 && num(m.taxes) === 0;
    },
  },
  {
    id: 'CMM-06',
    category: 'CMM',
    severity: 'info',
    title: 'Discount applied without note',
    description: 'Discount > 0 but no comment / coupon code attached.',
    appliesTo: 'reservation',
    check: ({ reservation }) => {
      const m = money(reservation);
      return num(m.discount) > 0 && !reservation.couponCode && !reservation.notes;
    },
  },
];

export const RULES_BY_ID = Object.fromEntries(RULES.map((r) => [r.id, r]));

export function rulesByCategory() {
  const out = {};
  for (const r of RULES) {
    (out[r.category] = out[r.category] || []).push(r);
  }
  return out;
}
