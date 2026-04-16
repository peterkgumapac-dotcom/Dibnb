import React, { useMemo } from 'react';
import { fmtCurrency, fmtShortDate, detectCurrency } from '../lib/format.js';
import {
  computeRevenue,
  byChannel,
  byListing,
  pricingAnomalies,
} from '../revenue/metrics.js';

export default function RevenueView({ data }) {
  const currency = detectCurrency(data);
  const fmt = (v) => fmtCurrency(v, currency);
  const pct = (v) => `${(v * 100).toFixed(1)}%`;

  const rev = useMemo(() => computeRevenue(data), [data]);
  const channels = useMemo(() => byChannel(data), [data]);
  const listings = useMemo(() => byListing(data), [data]);
  const anomalies = useMemo(() => pricingAnomalies(data), [data]);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Revenue</h1>
          <div className="page-sub">
            {data.period.from} → {data.period.to} · {rev.periodDays} days ·{' '}
            {data.listings.length} properties · <span className="tag">{currency}</span>
          </div>
        </div>
      </div>

      <div className="kpi-row">
        <Kpi label="ADR" value={fmt(rev.adr)} sub="Avg daily rate" />
        <Kpi
          label="RevPAR"
          value={fmt(rev.revpar)}
          sub="Revenue per available night"
        />
        <Kpi label="Occupancy" value={pct(rev.occupancy)} sub={`${rev.bookedNights} / ${rev.availableNights} nights`} />
        <Kpi label="Net revenue" value={fmt(rev.netRevenue)} sub="After commission & channel fees" />
      </div>

      <div className="kpi-row">
        <Kpi label="Gross rental" value={fmt(rev.rentalRevenue)} />
        <Kpi label="Cancellation rate" value={pct(rev.cancellationRate)} sub={`${rev.counts.cancelled} of ${rev.counts.total}`} />
        <Kpi label="Lead time" value={`${rev.avgLeadTime.toFixed(0)} days`} sub="Avg booking-to-stay" />
        <Kpi label="Owner-stay nights" value={`${rev.ownerStayNights}`} sub={`${rev.counts.ownerStay} stays`} />
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <div className="card-head">
          <h2>Channel mix &amp; margin</h2>
          <span className="muted">{channels.length} channels</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="os">
            <thead>
              <tr>
                <th>Channel</th>
                <th className="num">Bookings</th>
                <th className="num">Nights</th>
                <th className="num">Revenue</th>
                <th className="num">ADR</th>
                <th className="num">Commission</th>
                <th className="num">Channel fee</th>
                <th className="num">Net</th>
                <th className="num">Net margin</th>
              </tr>
            </thead>
            <tbody>
              {channels.length === 0 && (
                <tr>
                  <td colSpan={9} className="empty">
                    <p className="muted">No bookings in this period.</p>
                  </td>
                </tr>
              )}
              {channels.map((c) => (
                <tr key={c.channel}>
                  <td><span className="tag">{c.channel}</span></td>
                  <td className="num">{c.count}</td>
                  <td className="num">{c.nights}</td>
                  <td className="num">{fmt(c.revenue)}</td>
                  <td className="num">{fmt(c.adr)}</td>
                  <td className="num">{fmt(-c.commission)}</td>
                  <td className="num">{fmt(-c.channelFees)}</td>
                  <td className="num" style={{ fontWeight: 600 }}>{fmt(c.net)}</td>
                  <td className="num">{pct(c.netMargin)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <div className="card-head">
          <h2>Per-listing performance</h2>
          <span className="muted">{listings.length} listings</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="os">
            <thead>
              <tr>
                <th>Listing</th>
                <th className="num">Bookings</th>
                <th className="num">Nights</th>
                <th className="num">Occ.</th>
                <th className="num">ADR</th>
                <th className="num">RevPAR</th>
                <th className="num">Revenue</th>
                <th className="num">Net</th>
                <th className="num">Cancelled</th>
              </tr>
            </thead>
            <tbody>
              {listings.length === 0 && (
                <tr>
                  <td colSpan={9} className="empty">
                    <p className="muted">No listings for this owner.</p>
                  </td>
                </tr>
              )}
              {listings.map((l) => (
                <tr key={l.listingId}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{l.nickname}</div>
                    {l.title && l.title !== l.nickname && (
                      <div className="muted" style={{ fontSize: 11 }}>{l.title}</div>
                    )}
                  </td>
                  <td className="num">{l.confirmed}</td>
                  <td className="num">{l.nights}</td>
                  <td className="num">{pct(l.occupancy)}</td>
                  <td className="num">{fmt(l.adr)}</td>
                  <td className="num">{fmt(l.revpar)}</td>
                  <td className="num">{fmt(l.revenue)}</td>
                  <td className="num" style={{ fontWeight: 600 }}>{fmt(l.net)}</td>
                  <td className="num">{l.cancelled || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {anomalies.length > 0 && (
        <div className="card" style={{ marginTop: 18 }}>
          <div className="card-head">
            <h2>Pricing anomalies</h2>
            <span className="muted">{anomalies.length} below 60% of listing average</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="os">
              <thead>
                <tr>
                  <th>Listing</th>
                  <th>Booking</th>
                  <th>Stay</th>
                  <th className="num">Nightly rate</th>
                  <th className="num">Listing avg</th>
                  <th className="num">Δ</th>
                </tr>
              </thead>
              <tbody>
                {anomalies.map((a, i) => (
                  <tr key={i} className="row-warning">
                    <td>{a.reservation.listing?.nickname || a.reservation.listing?.title || a.listingId}</td>
                    <td>
                      {a.reservation.guest?.fullName || a.reservation.confirmationCode || '—'}
                    </td>
                    <td>
                      {fmtShortDate(a.reservation.checkIn)} → {fmtShortDate(a.reservation.checkOut)}
                    </td>
                    <td className="num">{fmt(a.nightly)}</td>
                    <td className="num">{fmt(a.averageNightly)}</td>
                    <td className="num" style={{ color: 'var(--sev-critical)', fontWeight: 600 }}>
                      {pct(a.deltaPct)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

function Kpi({ label, value, sub }) {
  return (
    <div className="kpi">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub ? <div className="delta">{sub}</div> : null}
    </div>
  );
}
