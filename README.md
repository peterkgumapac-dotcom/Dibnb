# LEV Collection — Owner Statement Dashboard

Reader-first dashboard that pulls owner statement data straight from Guesty's Open API,
shows every reservation / line item, and annotates each row inline with findings from a
35-rule audit checklist.

> Phase 1: Owner Statements (this repo). Phase 2: Reservation Management (later).

---

## Stack

- **React 18** + **Vite** (`.jsx`) — fast SPA, deployable to Netlify.
- **Netlify Functions** in `netlify/functions/*` (Web-standard handlers) — proxy
  Guesty's Open API so credentials never reach the browser and CORS is sidestepped.
- **Guesty Open API** with OAuth `client_credentials` flow. Token cached in module
  scope per warm function instance.
- **LEV Collection brand** — deep green `#04392b`, cream `#f6efdf`, pink accent
  `#f7c8d4`, Playfair Display for display copy, Inter for UI.

---

## How to view it

### 1. Locally

```bash
npm install
cp .env.example .env
# edit .env and put your real GUESTY_CLIENT_SECRET in
npm i -g netlify-cli
netlify dev
```

`netlify dev` runs Vite **and** the Functions runtime together on
**http://localhost:8888** — `/api/*` is routed straight to your functions
(thanks to the redirect in `netlify.toml`).

### 2. Deployed to Netlify

Either via the dashboard:

1. Push this repo to GitHub (already done on branch
   `claude/lev-owner-dashboard-8ebhc`).
2. In Netlify → **Add new site → Import from GitHub** → pick this repo.
3. Build settings are already in `netlify.toml` (`npm run build` → `dist/`,
   functions in `netlify/functions`).
4. **Site configuration → Environment variables** → add:
   - `GUESTY_CLIENT_ID` = `0oau4tffm8ZVsUtGo5d7`
   - `GUESTY_CLIENT_SECRET` = your real secret
5. Trigger a deploy. Netlify gives you a `https://<your-site>.netlify.app` URL.

Or via CLI:

```bash
netlify login
netlify init                                  # link / create the site
netlify env:set GUESTY_CLIENT_ID 0oau4tffm8ZVsUtGo5d7
netlify env:set GUESTY_CLIENT_SECRET '...'    # quote secrets with special chars
netlify deploy --build --prod
```

### 3. Quick sanity check

Open `/api/health` on your deployed URL (or `http://localhost:8888/api/health`).
You should see `{ "ok": true, "hasToken": true, "tokenPreview": "eyJ…abcd" }`.
If `hasToken: false`, the env vars aren't set on the site yet.

Then in the UI: pick an owner + month from the left sidebar and press
**Load statement**. Audit findings render as colour-coded badges on the rows
they affect — hover any badge to see the rule.

---

## Project layout

```
netlify/functions/
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
netlify.toml            build + functions + redirects + dev config
vite.config.js          dev server config
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
