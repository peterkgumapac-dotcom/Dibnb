import { guestyFetch, jsonResponse, errorResponse } from './_guesty.js';

// One endpoint that returns every owner with their listing nicknames attached.
// Cached on globalThis so it survives across warm invocations of this function.
const CACHE_KEY = '__lev_owners_cache__';
const TTL_MS = 10 * 60 * 1000;
globalThis[CACHE_KEY] = globalThis[CACHE_KEY] || { at: 0, payload: null };
const cache = globalThis[CACHE_KEY];

export default async () => {
  try {
    const now = Date.now();
    if (cache.payload && now - cache.at < TTL_MS) {
      return jsonResponse(200, cache.payload);
    }

    // Serialize the two calls so they share a single OAuth token (no token stampede).
    const ownersResp = await guestyFetch('/owners', { query: { limit: 200 } });
    const listingsResp = await guestyFetch('/listings', {
      query: { limit: 200, fields: '_id title nickname owners owner' },
    });

    const owners = Array.isArray(ownersResp?.results)
      ? ownersResp.results
      : Array.isArray(ownersResp)
      ? ownersResp
      : [];
    const listings = Array.isArray(listingsResp?.results)
      ? listingsResp.results
      : Array.isArray(listingsResp)
      ? listingsResp
      : [];

    const listingsByOwner = new Map();
    for (const l of listings) {
      const ids = [];
      if (Array.isArray(l.owners)) {
        for (const o of l.owners) {
          const id = typeof o === 'string' ? o : o?._id || o?.id || o?.ownerId;
          if (id) ids.push(id);
        }
      }
      if (l.owner) ids.push(typeof l.owner === 'string' ? l.owner : l.owner._id);
      for (const ownerId of ids) {
        if (!listingsByOwner.has(ownerId)) listingsByOwner.set(ownerId, []);
        listingsByOwner.get(ownerId).push({
          _id: l._id,
          title: l.title,
          nickname: l.nickname,
        });
      }
    }

    const enriched = owners.map((o) => {
      const id = o._id || o.id;
      const theirListings = listingsByOwner.get(id) || [];
      return { ...o, listings: theirListings };
    });

    const payload = { owners: enriched, totalListings: listings.length };
    cache.at = now;
    cache.payload = payload;
    return jsonResponse(200, payload);
  } catch (err) {
    return errorResponse(err);
  }
};

export const config = { path: '/api/owners-with-listings' };
