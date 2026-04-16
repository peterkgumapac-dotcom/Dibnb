# LEV Collection — Owner Statement Dashboard

Reader-first dashboard that pulls owner statement data straight from Guesty's Open API,
shows every reservation / line item, and annotates each row inline with findings from a
35-rule audit checklist.

> Phase 1: Owner Statements (this repo). Phase 2: Reservation Management (later).

---

## Stack

- **React 18** + **Vite** (`.jsx`) — fast SPA, deployable to Vercel.
- **Vercel Serverless Functions** in `/api/*` — proxy Guesty's Open API so credentials
  never reach the browser and CORS is sidestepped.
- **Guesty Open API** with OAuth `client_credentials` flow. Token cached in module scope
  per warm function instance.
- **LEV Collection brand** — deep green `#04392b`, cream `#f6efdf`, pink accent
  `#f7c8d4`, Playfair Display for display copy, Inter for UI.

---

## How to view it

### 1. Locally (recommended for dev)

```bash
npm install
cp .env.example .env
# edit .env and put your real GUESTY_CLIENT_SECRET in
npm run dev          # Vite UI at http://localhost:3000
```

Vite alone won't serve `/api/*`. Two options for the API in dev:

- **Easiest — Vercel CLI:** `npm i -g vercel` then `vercel dev` (serves both UI and
  `/api/*` on `http://localhost:3000`).
- **Manual:** run any small Node server that exposes `/api/health`, `/api/owners`,
  `/api/listings`, `/api/reservations`, `/api/owner-statement` — the Vite proxy
  forwards `/api` to `http://localhost:3001`.

Open http://localhost:3000 → pick an owner + month → **Load statement**.

### 2. Deployed to Vercel

```bash
npm i -g vercel
vercel link        # link to a new or existing Vercel project
vercel env add GUESTY_CLIENT_ID         # paste 0oau4tffm8ZVsUtGo5d7
vercel env add GUESTY_CLIENT_SECRET     # paste the secret
vercel --prod
```

Vercel will print a URL like `https://lev-owner-dashboard.vercel.app` — open it in your
browser.

### 3. Quick sanity check

Hit `/api/health` in the browser — you should get
`{ "ok": true, "hasToken": true, "tokenPreview": "eyJ…abcd" }`.
If `hasToken` is false, your env vars aren't set.

---

## Project layout

```
api/
  _guesty.js            shared OAuth + fetch helpers (token cache)
  health.js             GET /api/health
  owners.js             GET /api/owners
  listings.js           GET /api/listings?ownerId=…
  reservations.js       GET /api/reservations?from=…&to=…
  owner-statement.js    GET /api/owner-statement?ownerId=…&from=…&to=…
src/
  App.jsx               top-level layout, owner/period state
  main.jsx              React entry
  index.css             LEV brand tokens + layout
  components/
    Sidebar.jsx         owner picker + period + load button
    StatementView.jsx   KPIs + audit bar + reservations table
    AuditBadge.jsx      per-row badges with hover tooltip
  audit/
    rules.js            35 rules across 8 categories
    engine.js           runs rules against assembled statement
  lib/
    api.js              frontend HTTP client
    format.js           currency / date helpers
vercel.json             routing + function config
vite.config.js          dev server + /api proxy
```

---

## Audit rules

35 rules / 8 categories — see `src/audit/rules.js` for the full source.

| Code | Category               | Rules |
|------|------------------------|-------|
| BAL  | Statement Balance      | 5     |
| OWN  | Owner Stay             | 5     |
| CXL  | Cancelled Booking      | 4     |
| PAY  | Payment / Cash         | 4     |
| EXP  | Maintenance / Expenses | 4     |
| PRP  | Property Assignment    | 3     |
| CLI  | Client / Contract      | 4     |
| CMM  | Commission / Fees      | 6     |

The 10 priority error patterns from the LEV checklist all map to specific rules:

| Pattern                                                    | Rule(s)            |
|------------------------------------------------------------|--------------------|
| Cleaning on owner stay                                     | OWN-01             |
| Negative payout / cash double-counting                     | BAL-01, PAY-01     |
| Cleaning on cancelled booking                              | CXL-01             |
| Maintenance missing from OS                                | EXP-01, EXP-02     |
| Wrong property assignment                                  | PRP-01, PRP-02     |
| Initial balance carry-over wrong                           | CLI-02             |
| Terminated client still showing payable                    | CLI-01             |
| Linen/GE inconsistent on owner stays                       | OWN-02             |
| External vendor invoice missing                            | EXP-02, EXP-03     |
| Cancelled revenue counted in payout                        | CXL-02, CXL-04     |

Severities: **critical** (immediate finance impact), **warning** (likely defect),
**info** (worth a human look). Severity colours are reflected on the row background
and on each badge.

---

## Phase 2 (later)

Reservation management — edit reservations, push corrections back to Guesty, bulk
re-issue statements. Not in this repo yet.
