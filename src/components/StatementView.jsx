import React, { useMemo } from 'react';
import { fmtCurrency, fmtShortDate } from '../lib/format.js';
import { runAudit, collectLineItems } from '../audit/engine.js';
import { AuditBadges } from './AuditBadge.jsx';

function isCancelled(r) {
  const s = (r.status || '').toLowerCase();
  return s === 'canceled' || s === 'cancelled' || Boolean(r.cancelledAt);
}
function isOwnerStay(r) {
  const src = (r.source || '').toLowerCase();
  const ch = (r.channel || '').toLowerCase();
  const st = (r.status || '').toLowerCase();
  return st === 'owner stay' || src.includes('owner') || ch.includes('owner');
}

export default function StatementView({ data }) {
  const { period, owner, listings, reservations, expenses } = data;

  const enriched = useMemo(() => {
    const totals = reservations.reduce(
      (acc, r) => {
        const m = r.money || {};
        acc.income += m.fareAccommodation || 0;
        acc.cleaning += m.fareCleaning || 0;
        acc.commission += m.commission || 0;
        acc.channel += m.hostChannelFee || 0;
        acc.net += m.netIncome || 0;
        return acc;
      },
      { income: 0, cleaning: 0, commission: 0, channel: 0, net: 0 }
    );
    const expenseTotal = expenses.reduce((s, e) => s + (e.amount || 0), 0);
    const payout = totals.net - expenseTotal;

    const statement = {
      period,
      owner,
      listings,
      reservations,
      expenses,
      payout,
      income: totals.income,
      // priorAvgPayout / openingBalance / priorClosingBalance not yet wired
    };
    const audit = runAudit(statement);
    const lineItems = collectLineItems(statement);
    return { totals, expenseTotal, payout, statement, audit, lineItems };
  }, [period, owner, listings, reservations, expenses]);

  const { totals, expenseTotal, payout, audit, lineItems } = enriched;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {owner?.fullName || owner?.name || 'Owner statement'}
          </h1>
          <div className="page-sub">
            {period.from} → {period.to} · {listings.length} propert
            {listings.length === 1 ? 'y' : 'ies'} · {reservations.length} reservation
            {reservations.length === 1 ? '' : 's'}
          </div>
        </div>
      </div>

      <div className="kpi-row">
        <Kpi label="Rental income" value={fmtCurrency(totals.income)} />
        <Kpi label="Cleaning" value={fmtCurrency(totals.cleaning)} />
        <Kpi
          label="Commission + fees"
          value={fmtCurrency(-(totals.commission + totals.channel))}
        />
        <Kpi
          label="Statement payout"
          value={fmtCurrency(payout)}
          alert={payout <= 0}
        />
      </div>

      <AuditBar audit={audit} />

      {audit.statement.length > 0 && (
        <div className="card" style={{ marginBottom: 18 }}>
          <div className="card-head">
            <h2>Statement-level findings</h2>
          </div>
          <ul style={{ margin: 0, padding: '12px 18px' }}>
            {audit.statement.map((f) => (
              <li key={f.id} style={{ padding: '6px 0' }}>
                <AuditBadges findings={[f]} />{' '}
                <strong style={{ color: 'var(--lev-green)' }}>{f.title}</strong>{' '}
                <span className="muted">— {f.description}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <h2>Reservations &amp; line items</h2>
          <span className="muted">{reservations.length} reservations</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="os">
            <thead>
              <tr>
                <th>Booking</th>
                <th>Property</th>
                <th>Stay</th>
                <th>Channel</th>
                <th className="num">Income</th>
                <th className="num">Cleaning</th>
                <th className="num">Commission</th>
                <th className="num">Net</th>
                <th>Audit</th>
              </tr>
            </thead>
            <tbody>
              {reservations.length === 0 && (
                <tr>
                  <td colSpan={9} className="empty">
                    <h3>No reservations in this period</h3>
                    <p className="muted">Try a different month.</p>
                  </td>
                </tr>
              )}
              {reservations.map((r) => {
                const m = r.money || {};
                const findings = audit.reservations[r._id || r.id] || [];
                const sev = severityClass(findings);
                return (
                  <React.Fragment key={r._id || r.id}>
                    <tr className={sev}>
                      <td>
                        <div style={{ fontWeight: 600 }}>
                          {r.guest?.fullName || r.confirmationCode || '—'}
                        </div>
                        <div className="muted" style={{ fontSize: 11 }}>
                          {r.confirmationCode}
                        </div>
                      </td>
                      <td>{r.listing?.nickname || r.listing?.title || r.listingId}</td>
                      <td>
                        {fmtShortDate(r.checkIn)} → {fmtShortDate(r.checkOut)}
                        <div className="muted" style={{ fontSize: 11 }}>
                          {r.nightsCount || ''} nt
                        </div>
                      </td>
                      <td>
                        {isOwnerStay(r) && <span className="tag owner">Owner stay</span>}
                        {isCancelled(r) && <span className="tag cancel">Cancelled</span>}
                        {!isOwnerStay(r) && !isCancelled(r) && (
                          <span className="tag">{r.source || r.channel || '—'}</span>
                        )}
                      </td>
                      <td className="num">{fmtCurrency(m.fareAccommodation || 0)}</td>
                      <td className="num">{fmtCurrency(m.fareCleaning || 0)}</td>
                      <td className="num">
                        {fmtCurrency(-(m.commission || 0))}
                      </td>
                      <td className="num" style={{ fontWeight: 600 }}>
                        {fmtCurrency(m.netIncome || 0)}
                      </td>
                      <td>
                        <AuditBadges findings={findings} />
                      </td>
                    </tr>
                    {lineItemsFor(lineItems, r).map((li) => {
                      const lf = audit.lineItems[li.id] || [];
                      return (
                        <tr className="line-item" key={li.id}>
                          <td>↳ {li.title}</td>
                          <td colSpan={3} className="muted">
                            {li.kind}
                          </td>
                          <td className="num" colSpan={4}>
                            {fmtCurrency(li.amount)}
                          </td>
                          <td>
                            <AuditBadges findings={lf} />
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
              {expenses.length > 0 && (
                <>
                  <tr>
                    <td colSpan={9} style={{ background: 'var(--lev-cream-dark)' }}>
                      <strong style={{ color: 'var(--lev-green)' }}>Expenses</strong>
                    </td>
                  </tr>
                  {expenses.map((e) => {
                    const li = lineItems.find((x) => x.id === `exp:${e._id || e.id}`);
                    const lf = li ? audit.lineItems[li.id] || [] : [];
                    return (
                      <tr key={e._id || e.id} className="line-item">
                        <td>{e.description || e.title || 'Expense'}</td>
                        <td colSpan={3} className="muted">
                          {e.vendor || ''}
                        </td>
                        <td colSpan={4} className="num">
                          {fmtCurrency(-(e.amount || 0))}
                        </td>
                        <td>
                          <AuditBadges findings={lf} />
                        </td>
                      </tr>
                    );
                  })}
                </>
              )}
              <tr>
                <td colSpan={4} style={{ fontWeight: 700, color: 'var(--lev-green)' }}>
                  Statement payout
                </td>
                <td className="num">{fmtCurrency(totals.income)}</td>
                <td className="num">{fmtCurrency(totals.cleaning)}</td>
                <td className="num">{fmtCurrency(-(totals.commission))}</td>
                <td
                  className="num"
                  style={{
                    fontWeight: 700,
                    color: payout < 0 ? 'var(--sev-critical)' : 'var(--lev-green)',
                  }}
                >
                  {fmtCurrency(payout)}
                </td>
                <td>{expenseTotal ? <span className="muted">incl. expenses</span> : null}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function lineItemsFor(allItems, reservation) {
  const id = reservation._id || reservation.id;
  return allItems.filter((li) => li.id.startsWith(`${id}:`));
}

function severityClass(findings) {
  if (findings.some((f) => f.severity === 'critical')) return 'has-critical';
  if (findings.some((f) => f.severity === 'warning')) return 'has-warning';
  return '';
}

function Kpi({ label, value, alert }) {
  return (
    <div className={`kpi ${alert ? 'alert' : ''}`}>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}

function AuditBar({ audit }) {
  const s = audit.summary;
  return (
    <div className="audit-bar">
      <span className="lead">Audit</span>
      <span className={`chip ${s.critical ? 'critical' : 'neutral'}`}>
        {s.critical} critical
      </span>
      <span className={`chip ${s.warning ? 'warning' : 'neutral'}`}>
        {s.warning} warnings
      </span>
      <span className={`chip ${s.info ? 'info' : 'neutral'}`}>{s.info} info</span>
      <span className="muted" style={{ marginLeft: 'auto', fontSize: 12 }}>
        35 rules checked across 8 categories
      </span>
    </div>
  );
}
