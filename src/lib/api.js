// Frontend API client. Calls the Vercel serverless functions under /api/*.

async function getJson(url) {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Non-JSON response from ${url}: ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    const msg = data?.error || `Request failed: ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

export const api = {
  health: () => getJson('/api/health'),
  owners: ({ limit = 100, skip = 0 } = {}) =>
    getJson(`/api/owners?limit=${limit}&skip=${skip}`),
  ownersWithListings: () => getJson('/api/owners-with-listings'),
  listings: ({ ownerId } = {}) =>
    getJson(`/api/listings${ownerId ? `?ownerId=${encodeURIComponent(ownerId)}` : ''}`),
  reservations: ({ from, to, ownerId, listingId, limit = 100, skip = 0 }) => {
    const p = new URLSearchParams({ from, to, limit, skip });
    if (ownerId) p.set('ownerId', ownerId);
    if (listingId) p.set('listingId', listingId);
    return getJson(`/api/reservations?${p.toString()}`);
  },
  ownerStatement: ({ ownerId, from, to }) =>
    getJson(
      `/api/owner-statement?ownerId=${encodeURIComponent(ownerId)}&from=${from}&to=${to}`
    ),
};
