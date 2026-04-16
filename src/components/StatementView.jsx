import React, { useMemo, useState } from 'react';
import { fmtCurrency, fmtShortDate, detectCurrency } from '../lib/format.js';
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
  const { period, owner, listings, reservations, expenses, publishedStatement } = data;
  const [onlyFailing, setOnlyFailing] = useState(false);
  const [expanded, setExpanded] = useState({}); // reservationId -> bool
  const currency = detectCurrency(data);
  const fmt = (v) => fmtCurrency(v, currency);

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
    };
    const audit = runAudit(statement);
    const lineItems = collectLineItems(statement);
    return { totals, expenseTotal, payout, statement, audit, lineItems };
  }, [period, owner, listings, reservations, expenses]);

  const { totals, expenseTotal, payout, audit, lineItems } = enriched;

  const rowSev = (r) => {
    const findings = audit.reservations[r._id || r.id] || [];
    if (findings.some((f) => f.severity === 'critical')) return 'critical';
    if (findings.some((f) => f.severity === 'warning')) return 'warning';
    if (findings.some((f) => f.severity === 'info')) return 'info';
    return null;
  };

  const visibleReservations = onlyFailing
    ? reservations.filter((r) => rowSev(r) != null)
    : reservations;

  const failingCount = reservations.filter((r) => rowSev(r) != null).length;

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
            {reservations.length === 1 ? '' : 's'} · <span className="tag">{currency}</span>
            {listings.length > 0 && (
              <div className="listings-chips" style={{ marginTop: 6 }}>
                {listings.slice(0, 8).map((l) => (
                  <span key={l._id || l.id} className="chip neutral" title={l.title}>
                    {l.nickname || l.title}
                  </span>
                ))}
                {listings.length > 8 && (
                  <span className="chip neutral">+{listings.length - 8} more</span>
                )}
              </div>
            )}
            {publishedStatement && (
              <>
                {' · '}
                <span className="muted">
                  Guesty statement{' '}
                  <strong>
                    {publishedStatement.number || publishedStatement._id?.slice(-6) || '—'}
                  </strong>
                  {publishedStatement.status ? ` (${publishedStatement.status})` : ''}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="kpi-row">
        <Kpi label="Rental income" value={fmt(totals.income)} />
        <Kpi label="Cleaning" value={fmt(totals.cleaning)} />
        <Kpi
          label="Commission + fees"
          value={fmt(-(totals.commission + totals.channel))}
        />
        <Kpi
          label="Statement payout"
          value={fmt(payout)}
          alert={payout <= 0}
        />
      </div>

      <AuditBar
        audit={audit}
        failingCount={failingCount}
        total={reservations.length}
        onlyFailing={onlyFailing}
        setOnlyFailing={setOnlyFailing}
      />

      {audit.statement.length > 0 && (
        <div className="card findings-panel" style={{ marginBottom: 18 }}>
          <div className="card-head">
            <h2>Statement-level findings</h2>
          </div>
          <ul style={{ margin: 0, padding: '12px 18px' }}>
            {audit.statement.map((f) => (
              <li key={f.id} className={`finding-row ${f.severity}`}>
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
          <span className="muted">
            {visibleReservations.length} of {reservations.length}
            {onlyFailing ? ' failing' : ''}
          </span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="os">
            <thead>
              <tr>
                <th style={{ width: 28 }}></th>
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
              {visibleReservations.length === 0 && (
                <tr>
                  <td colSpan={10} className="empty">
                    <h3>
                      {onlyFailing ? 'No failing reservations' : 'No reservations in this period'}
                    </h3>
                    <p className="muted">
                      {onlyFailing
                        ? 'Everything passed the audit. Toggle "Show only failing" off to see all rows.'
                        : 'Try a different month.'}
                    </p>
                  </td>
                </tr>
              )}
              {visibleReservations.map((r) => {
                const m = r.money || {};
                const findings = audit.reservations[r._id || r.id] || [];
                const sev = rowSev(r);
                const rid = r._id || r.id;
                const isOpen = expanded[rid] ?? sev != null;
                const lines = lineItemsFor(lineItems, r);
                return (
                  <React.Fragment key={rid}>
                    <tr className={sev ? `row-${sev}` : 'row-pass'}>
                      <td className="expander">
                        {lines.length > 0 && (
                          <button
                            className="disclosure"
                            onClick={() =>
                              setExpanded((s) => ({ ...s, [rid]: !isOpen }))
                            }
                            aria-label={isOpen ? 'Collapse' : 'Expand'}
                          >
                            {isOpen ? '▾' : '▸'}
                          </button>
                        )}
                      </td>
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
                      <td className="num">{fmt(m.fareAccommodation || 0)}</td>
                      <td className="num">{fmt(m.fareCleaning || 0)}</td>
                      <td className="num">
                        {fmt(-(m.commission || 0))}
                      </td>
                      <td className="num" style={{ fontWeight: 600 }}>
                        {fmt(m.netIncome || 0)}
                      </td>
                      <td>
                        <AuditBadges findings={findings} />
                      </td>
                    </tr>
                    {findings.length > 0 && (
                      <tr className={`finding-strip finding-${sev}`}>
                        <td></td>
                        <td colSpan={9}>
                          {findings.map((f) => (
                            <div key={f.id} className={`finding-line ${f.severity}`}>
                              <AuditBadges findings={[f]} />{' '}
                              <strong>{f.title}</strong>{' '}
                              <span className="muted">— {f.description}</span>
                            </div>
                          ))}
                        </td>
                      </tr>
                    )}
                    {isOpen &&
                      lines.map((li) => {
                        const lf = audit.lineItems[li.id] || [];
                        return (
                          <tr className="line-item" key={li.id}>
                            <td></td>
                            <td>↳ {li.title}</td>
                            <td colSpan={3} className="muted">
                              {li.kind}
                            </td>
                            <td className="num" colSpan={4}>
                              {fmt(li.amount)}
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
              {expenses.length > 0 && !onlyFailing && (
                <>
                  <tr>
                    <td
                      colSpan={10}
                      style={{ background: 'var(--lev-cream-dark)' }}
                    >
                      <strong style={{ color: 'var(--lev-green)' }}>Expenses</strong>
                    </td>
                  </tr>
                  {expenses.map((e) => {
                    const li = lineItems.find((x) => x.id === `exp:${e._id || e.id}`);
                    const lf = li ? audit.lineItems[li.id] || [] : [];
                    return (
                      <tr key={e._id || e.id} className="line-item">
                        <td></td>
                        <td>{e.description || e.title || 'Expense'}</td>
                        <td colSpan={3} className="muted">
                          {e.vendor || ''}
                        </td>
                        <td colSpan={4} className="num">
                          {fmt(-(e.amount || 0))}
                        </td>
                        <td>
                          <AuditBadges findings={lf} />
                        </td>
                      </tr>
                    );
                  })}
                </>
              )}
              {!onlyFailing && (
                <tr>
                  <td></td>
                  <td colSpan={4} style={{ fontWeight: 700, color: 'var(--lev-green)' }}>
                    Statement payout
                  </td>
                  <td className="num">{fmt(totals.income)}</td>
                  <td className="num">{fmt(totals.cleaning)}</td>
                  <td className="num">{fmt(-totals.commission)}</td>
                  <td
                    className="num"
                    style={{
                      fontWeight: 700,
                      color: payout < 0 ? 'var(--sev-critical)' : 'var(--lev-green)',
                    }}
                  >
                    {fmt(payout)}
                  </td>
                  <td>
                    {expenseTotal ? <span className="muted">incl. expenses</span> : null}
                  </td>
                </tr>
              )}
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

function Kpi({ label, value, alert }) {
  return (
    <div className={`kpi ${alert ? 'alert' : ''}`}>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}

function AuditBar({ audit, failingCount, total, onlyFailing, setOnlyFailing }) {
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
      <span className="muted" style={{ marginLeft: 12, fontSize: 12 }}>
        {failingCount} of {total} reservations with findings
      </span>
      <label className="toggle" style={{ marginLeft: 'auto' }}>
        <input
          type="checkbox"
          checked={onlyFailing}
          onChange={(e) => setOnlyFailing(e.target.checked)}
        />
        Show only failing
      </label>
    </div>
  );
}
