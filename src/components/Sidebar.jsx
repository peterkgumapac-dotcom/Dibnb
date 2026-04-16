import React from 'react';
import { currentMonthYYYYMM, offsetMonthYYYYMM, labelForYYYYMM } from '../lib/format.js';

export default function Sidebar({
  owners,
  ownerId,
  setOwnerId,
  period,
  setPeriod,
  onLoad,
  loading,
  health,
  ownersError,
}) {
  const presets = [
    { key: 'thisMonth', label: 'This month', value: currentMonthYYYYMM() },
    { key: 'lastMonth', label: 'Last month', value: offsetMonthYYYYMM(-1) },
    { key: 'twoBack', label: offsetMonthLabel(-2), value: offsetMonthYYYYMM(-2) },
    { key: 'threeBack', label: offsetMonthLabel(-3), value: offsetMonthYYYYMM(-3) },
  ];

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">LEV</div>
        <div className="brand-sub">Collection · Owner Portal</div>
      </div>

      <h3>Period</h3>
      <div className="preset-row">
        {presets.map((p) => (
          <button
            key={p.key}
            className={`preset ${period === p.value ? 'active' : ''}`}
            onClick={() => setPeriod(p.value)}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="field">
        <label htmlFor="period">Or pick a month</label>
        <input
          id="period"
          type="month"
          value={period}
          max={currentMonthYYYYMM()}
          onChange={(e) => setPeriod(e.target.value)}
        />
        <div className="field-hint">Showing {labelForYYYYMM(period)}</div>
      </div>

      <h3>Owner</h3>
      <div className="field">
        <label htmlFor="owner">Select owner</label>
        <select
          id="owner"
          value={ownerId || ''}
          onChange={(e) => setOwnerId(e.target.value)}
          disabled={!owners.length}
        >
          <option value="">{owners.length ? '— choose —' : 'Loading…'}</option>
          {owners.map((o) => {
            const id = o._id || o.id;
            const name = o.fullName || o.name || o.email || id;
            const list = o.listings || [];
            const summary = list.length
              ? `  —  ${list
                  .slice(0, 3)
                  .map((l) => l.nickname || l.title)
                  .filter(Boolean)
                  .join(', ')}${list.length > 3 ? ` +${list.length - 3} more` : ''}`
              : '';
            const countSuffix = list.length ? `  (${list.length})` : '';
            return (
              <option key={id} value={id}>
                {name}{countSuffix}{summary}
              </option>
            );
          })}
        </select>
        {ownerId ? <OwnerListings owners={owners} ownerId={ownerId} /> : null}
        {ownersError ? (
          <div style={{ fontSize: 11, color: 'var(--lev-pink)' }}>{ownersError}</div>
        ) : null}
      </div>

      <button
        className="btn-primary"
        disabled={!ownerId || loading}
        onClick={onLoad}
      >
        {loading ? 'Loading…' : 'Load statement'}
      </button>

      <div className={`health ${health?.ok ? 'ok' : health ? 'bad' : ''}`}>
        <span className="dot" />
        <span>
          {health?.ok
            ? 'Guesty connected'
            : health
            ? 'Guesty error'
            : 'Checking Guesty…'}
        </span>
      </div>
    </aside>
  );
}

function OwnerListings({ owners, ownerId }) {
  const owner = owners.find((o) => (o._id || o.id) === ownerId);
  const list = owner?.listings || [];
  if (!list.length) return null;
  return (
    <ul className="owner-listings">
      {list.map((l) => (
        <li key={l._id} title={l.title}>
          {l.nickname || l.title}
        </li>
      ))}
    </ul>
  );
}

function offsetMonthLabel(offset) {
  const yyyyMm = offsetMonthYYYYMM(offset);
  const [, m] = yyyyMm.split('-');
  return new Date(2000, Number(m) - 1, 1).toLocaleDateString('en-GB', { month: 'short' });
}
