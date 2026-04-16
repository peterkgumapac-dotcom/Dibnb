// Revenue metrics derived from the same data we fetch for the owner statement.
// No new API calls — all of this comes from `reservations` + `listings` + `period`.

const num = (v) => (typeof v === 'number' && !isNaN(v) ? v : 0);
const isCancelled = (r) => {
  const s = (r.status || '').toLowerCase();
  return s === 'canceled' || s === 'cancelled' || Boolean(r.cancelledAt);
};
const isOwnerStay = (r) => {
  const src = (r.source || '').toLowerCase();
  const ch = (r.channel || '').toLowerCase();
  const st = (r.status || '').toLowerCase();
  return st === 'owner stay' || src.includes('owner') || ch.includes('owner');
};

export function daysInPeriod(period) {
  const from = new Date(period.from);
  const to = new Date(period.to);
  return Math.max(1, Math.round((to - from) / 86_400_000) + 1);
}

// Nights of a reservation that actually fall inside the period.
export function nightsInPeriod(r, period) {
  const pFrom = new Date(period.from);
  const pTo = new Date(period.to);
  pTo.setUTCHours(23, 59, 59, 999);
  const rFrom = new Date(r.checkIn);
  const rTo = new Date(r.checkOut);
  const start = rFrom > pFrom ? rFrom : pFrom;
  const end = rTo < pTo ? rTo : pTo;
  const ms = end - start;
  if (ms <= 0) return 0;
  return Math.max(0, Math.round(ms / 86_400_000));
}

export function computeRevenue({ reservations, listings, period }) {
  const revenueReservations = reservations.filter(
    (r) => !isCancelled(r) && !isOwnerStay(r)
  );
  const ownerStays = reservations.filter((r) => !isCancelled(r) && isOwnerStay(r));
  const cancellations = reservations.filter(isCancelled);

  const periodDays = daysInPeriod(period);
  const availableNights = Math.max(1, listings.length * periodDays);

  let bookedNights = 0;
  let rentalRevenue = 0;
  let cleaningRevenue = 0;
  let commission = 0;
  let channelFees = 0;
  let leadTimeDaysSum = 0;
  let leadTimeCount = 0;

  for (const r of revenueReservations) {
    const m = r.money || {};
    const nights = nightsInPeriod(r, period) || num(r.nightsCount);
    bookedNights += nights;
    rentalRevenue += num(m.fareAccommodation);
    cleaningRevenue += num(m.fareCleaning);
    commission += num(m.commission);
    channelFees += num(m.hostChannelFee);
    if (r.createdAt && r.checkIn) {
      const lead = Math.round(
        (new Date(r.checkIn) - new Date(r.createdAt)) / 86_400_000
      );
      if (lead >= 0) {
        leadTimeDaysSum += lead;
        leadTimeCount += 1;
      }
    }
  }

  const cancelledRevenue = cancellations.reduce(
    (s, r) => s + num(r.money?.fareAccommodation),
    0
  );
  const ownerStayNights = ownerStays.reduce(
    (s, r) => s + (nightsInPeriod(r, period) || num(r.nightsCount)),
    0
  );

  const adr = bookedNights > 0 ? rentalRevenue / bookedNights : 0;
  const revpar = rentalRevenue / availableNights;
  const occupancy = bookedNights / availableNights;
  const avgLeadTime = leadTimeCount > 0 ? leadTimeDaysSum / leadTimeCount : 0;
  const cancellationRate =
    reservations.length > 0 ? cancellations.length / reservations.length : 0;
  const netRevenue = rentalRevenue - commission - channelFees;

  return {
    periodDays,
    availableNights,
    bookedNights,
    ownerStayNights,
    rentalRevenue,
    cleaningRevenue,
    commission,
    channelFees,
    netRevenue,
    cancelledRevenue,
    cancellationRate,
    avgLeadTime,
    adr,
    revpar,
    occupancy,
    counts: {
      confirmed: revenueReservations.length,
      ownerStay: ownerStays.length,
      cancelled: cancellations.length,
      total: reservations.length,
    },
  };
}

export function byChannel({ reservations, period }) {
  const buckets = new Map();
  for (const r of reservations) {
    if (isCancelled(r) || isOwnerStay(r)) continue;
    const key = (r.source || r.channel || 'Direct').toString();
    const b = buckets.get(key) || {
      channel: key,
      count: 0,
      nights: 0,
      revenue: 0,
      commission: 0,
      channelFees: 0,
    };
    const m = r.money || {};
    b.count += 1;
    b.nights += nightsInPeriod(r, period) || num(r.nightsCount);
    b.revenue += num(m.fareAccommodation);
    b.commission += num(m.commission);
    b.channelFees += num(m.hostChannelFee);
    buckets.set(key, b);
  }
  return Array.from(buckets.values())
    .map((b) => ({
      ...b,
      adr: b.nights > 0 ? b.revenue / b.nights : 0,
      net: b.revenue - b.commission - b.channelFees,
      netMargin: b.revenue > 0 ? (b.revenue - b.commission - b.channelFees) / b.revenue : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

export function byListing({ reservations, listings, period }) {
  const periodDays = daysInPeriod(period);
  const byId = new Map();
  for (const l of listings) {
    const id = l._id || l.id;
    byId.set(id, {
      listingId: id,
      nickname: l.nickname || l.title || id,
      title: l.title,
      nights: 0,
      revenue: 0,
      commission: 0,
      channelFees: 0,
      confirmed: 0,
      cancelled: 0,
      ownerStay: 0,
    });
  }
  for (const r of reservations) {
    const id = r.listingId;
    if (!byId.has(id)) {
      byId.set(id, {
        listingId: id,
        nickname: r.listing?.nickname || r.listing?.title || id,
        title: r.listing?.title,
        nights: 0,
        revenue: 0,
        commission: 0,
        channelFees: 0,
        confirmed: 0,
        cancelled: 0,
        ownerStay: 0,
      });
    }
    const b = byId.get(id);
    if (isCancelled(r)) {
      b.cancelled += 1;
      continue;
    }
    if (isOwnerStay(r)) {
      b.ownerStay += 1;
      continue;
    }
    const m = r.money || {};
    const nights = nightsInPeriod(r, period) || num(r.nightsCount);
    b.nights += nights;
    b.revenue += num(m.fareAccommodation);
    b.commission += num(m.commission);
    b.channelFees += num(m.hostChannelFee);
    b.confirmed += 1;
  }
  return Array.from(byId.values())
    .map((b) => ({
      ...b,
      adr: b.nights > 0 ? b.revenue / b.nights : 0,
      revpar: b.revenue / Math.max(1, periodDays),
      occupancy: b.nights / Math.max(1, periodDays),
      net: b.revenue - b.commission - b.channelFees,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

// Flag listings priced well below their own average ADR on specific nights.
export function pricingAnomalies({ reservations, period, zThreshold = 0.6 }) {
  const adrByListing = new Map();
  for (const r of reservations) {
    if (isCancelled(r) || isOwnerStay(r)) continue;
    const m = r.money || {};
    const nights = nightsInPeriod(r, period) || num(r.nightsCount);
    if (nights <= 0) continue;
    const nightly = num(m.fareAccommodation) / nights;
    const id = r.listingId;
    const arr = adrByListing.get(id) || [];
    arr.push({ reservation: r, nightly, nights });
    adrByListing.set(id, arr);
  }
  const anomalies = [];
  for (const [id, arr] of adrByListing) {
    if (arr.length < 2) continue;
    const mean = arr.reduce((s, x) => s + x.nightly, 0) / arr.length;
    for (const x of arr) {
      if (x.nightly < mean * zThreshold && mean > 0) {
        anomalies.push({
          listingId: id,
          reservation: x.reservation,
          nightly: x.nightly,
          averageNightly: mean,
          deltaPct: (x.nightly - mean) / mean,
        });
      }
    }
  }
  return anomalies.sort((a, b) => a.deltaPct - b.deltaPct);
}
