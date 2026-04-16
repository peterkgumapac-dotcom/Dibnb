import React, { useEffect, useState } from 'react';
import Sidebar from './components/Sidebar.jsx';
import StatementView from './components/StatementView.jsx';
import { api } from './lib/api.js';
import { currentMonthYYYYMM, monthRange } from './lib/format.js';

export default function App() {
  const [owners, setOwners] = useState([]);
  const [ownersError, setOwnersError] = useState(null);
  const [ownerId, setOwnerId] = useState('');
  const [period, setPeriod] = useState(currentMonthYYYYMM());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [statement, setStatement] = useState(null);
  const [health, setHealth] = useState(null);

  useEffect(() => {
    api
      .health()
      .then((h) => setHealth(h))
      .catch((e) => setHealth({ ok: false, error: e.message }));

    api
      .ownersWithListings()
      .then((res) => setOwners(res.owners || []))
      .catch((e) => {
        // Fallback to the bare /owners list if the combined endpoint is unreachable.
        setOwnersError(e.message);
        api
          .owners({ limit: 200 })
          .then((res) => {
            const list = Array.isArray(res?.results)
              ? res.results
              : Array.isArray(res)
              ? res
              : [];
            setOwners(list);
            setOwnersError(null);
          })
          .catch((e2) => setOwnersError(e2.message));
      });
  }, []);

  async function loadStatement() {
    if (!ownerId) return;
    setLoading(true);
    setError(null);
    setStatement(null);
    try {
      const range = monthRange(period);
      const data = await api.ownerStatement({ ownerId, ...range });
      setStatement(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      <Sidebar
        owners={owners}
        ownerId={ownerId}
        setOwnerId={setOwnerId}
        period={period}
        setPeriod={setPeriod}
        onLoad={loadStatement}
        loading={loading}
        health={health}
        ownersError={ownersError}
      />

      <main className="main">
        {error && <div className="error">⚠ {error}</div>}

        {!statement && !loading && (
          <Welcome />
        )}
        {loading && (
          <div className="empty">
            <span className="spinner" /> Loading owner statement…
          </div>
        )}
        {statement && <StatementView data={statement} />}
      </main>
    </div>
  );
}

function Welcome() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Owner Statement Dashboard</h1>
          <div className="page-sub">
            Reader-first view over Guesty data, with a 35-rule audit applied inline.
          </div>
        </div>
      </div>

      <div className="notice">
        Pick an owner and a month from the left, then press <strong>Load statement</strong>.
        Findings are colour-coded: <span className="badge critical">critical</span>{' '}
        <span className="badge warning">warning</span>{' '}
        <span className="badge info">info</span>. Hover any badge to see the rule.
      </div>

      <div className="card" style={{ padding: 18 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--lev-green)', marginTop: 0 }}>
          What this dashboard shows
        </h2>
        <ul style={{ lineHeight: 1.7 }}>
          <li>Every reservation in the selected month for the selected owner.</li>
          <li>Every line item — rental income, cleaning, commission, channel fees, expenses.</li>
          <li>
            Audit badges on the rows they affect — e.g.{' '}
            <span className="badge critical">OWN-01</span> next to a cleaning fee on an
            owner stay, <span className="badge critical">CXL-01</span> on a cancelled
            booking still carrying cleaning, etc.
          </li>
          <li>Statement-level findings (negative payout, terminated client, etc.) at the top.</li>
        </ul>
      </div>
    </div>
  );
}
