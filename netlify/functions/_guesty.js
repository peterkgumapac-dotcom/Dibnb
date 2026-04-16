// Shared helpers for Guesty Open API Netlify Functions.
//
// Caches the OAuth token on `globalThis` so every warm invocation of every
// function on the same instance reuses it, and adds retry-with-backoff on
// 429 responses — Guesty's /oauth2/token endpoint is strict.

const TOKEN_URL = process.env.GUESTY_TOKEN_URL || 'https://open-api.guesty.com/oauth2/token';
const API_BASE = process.env.GUESTY_API_BASE || 'https://open-api.guesty.com/v1';

const CACHE_KEY = '__lev_guesty_cache__';
globalThis[CACHE_KEY] = globalThis[CACHE_KEY] || {
  token: null,
  expiresAt: 0,
  inflight: null,
};

const cache = globalThis[CACHE_KEY];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchWithRetry(url, options, { tries = 4, baseDelay = 400 } = {}) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.status === 429 || res.status === 503) {
        // Respect Retry-After if present; otherwise exponential backoff.
        const ra = Number(res.headers.get('retry-after'));
        const delay = Number.isFinite(ra) && ra > 0 ? ra * 1000 : baseDelay * 2 ** i;
        if (i === tries - 1) return res; // out of retries; return the 429
        await sleep(delay);
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err;
      await sleep(baseDelay * 2 ** i);
    }
  }
  throw lastErr || new Error('fetchWithRetry exhausted');
}

export async function getAccessToken() {
  const now = Date.now();
  if (cache.token && cache.expiresAt - 60_000 > now) return cache.token;

  // Coalesce concurrent token refreshes into a single in-flight request.
  if (cache.inflight) return cache.inflight;

  const clientId = process.env.GUESTY_CLIENT_ID;
  const clientSecret = process.env.GUESTY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Missing GUESTY_CLIENT_ID / GUESTY_CLIENT_SECRET env vars');
  }

  cache.inflight = (async () => {
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'open-api',
      client_id: clientId,
      client_secret: clientSecret,
    });
    const res = await fetchWithRetry(
      TOKEN_URL,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          accept: 'application/json',
        },
        body,
      },
      { tries: 5, baseDelay: 600 }
    );
    if (!res.ok) {
      const text = await res.text();
      const err = new Error(`Guesty token error ${res.status}: ${text}`);
      err.status = res.status;
      throw err;
    }
    const json = await res.json();
    const expiresInMs = (json.expires_in || 3600) * 1000;
    cache.token = json.access_token;
    cache.expiresAt = Date.now() + expiresInMs;
    return cache.token;
  })();

  try {
    return await cache.inflight;
  } finally {
    cache.inflight = null;
  }
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
  const res = await fetchWithRetry(url.toString(), {
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

export function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

export function errorResponse(err) {
  const status = err.status || 500;
  return jsonResponse(status, {
    error: err.message || 'Unknown error',
    detail: err.body || null,
  });
}
