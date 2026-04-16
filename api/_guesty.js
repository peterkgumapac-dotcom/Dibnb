// Shared helpers for Guesty Open API serverless functions.
// Caches the OAuth token in module scope so warm invocations reuse it.

const TOKEN_URL = process.env.GUESTY_TOKEN_URL || 'https://open-api.guesty.com/oauth2/token';
const API_BASE = process.env.GUESTY_API_BASE || 'https://open-api.guesty.com/v1';

let cached = { token: null, expiresAt: 0 };

export async function getAccessToken() {
  const now = Date.now();
  if (cached.token && cached.expiresAt - 60_000 > now) {
    return cached.token;
  }

  const clientId = process.env.GUESTY_CLIENT_ID;
  const clientSecret = process.env.GUESTY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Missing GUESTY_CLIENT_ID / GUESTY_CLIENT_SECRET env vars');
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    scope: 'open-api',
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      accept: 'application/json',
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Guesty token error ${res.status}: ${text}`);
  }

  const json = await res.json();
  const expiresInMs = (json.expires_in || 3600) * 1000;
  cached = { token: json.access_token, expiresAt: now + expiresInMs };
  return cached.token;
}

export async function guestyFetch(path, { query, method = 'GET', body } = {}) {
  const token = await getAccessToken();
  const url = new URL(API_BASE + path);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === '') continue;
      url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url.toString(), {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/json',
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(`Guesty ${method} ${path} ${res.status}`);
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

export function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(payload));
}

export function handleError(res, err) {
  const status = err.status || 500;
  sendJson(res, status, {
    error: err.message || 'Unknown error',
    detail: err.body || null,
  });
}
