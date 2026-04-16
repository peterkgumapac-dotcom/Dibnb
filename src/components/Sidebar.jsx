import React from 'react';
import { currentMonthYYYYMM } from '../lib/format.js';

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
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">LEV</div>
        <div className="brand-sub">Collection · Owner Portal</div>
      </div>

      <h3>Period</h3>
      <div className="field">
        <label htmlFor="period">Statement month</label>
        <input
          id="period"
          type="month"
          value={period}
          max={currentMonthYYYYMM()}
          onChange={(e) => setPeriod(e.target.value)}
        />
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
          {owners.map((o) => (
            <option key={o._id || o.id} value={o._id || o.id}>
              {o.fullName || o.name || o.email || o._id}
            </option>
          ))}
        </select>
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
