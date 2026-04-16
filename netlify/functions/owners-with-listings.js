import { guestyFetch, jsonResponse, errorResponse } from './_guesty.js';

// One endpoint that returns every owner with their listing nicknames attached.
// The Sidebar uses this so the owner dropdown can show e.g.
//   "Thomas Algrøy — Nedre Gartn. 4-302, Haugeveien 11 (5)"
//
// Cached for 5 minutes per function instance so we don't keep paying
// the two underlying Guesty calls on every page view.
let CACHED = { at: 0, payload: null };
const TTL_MS = 5 * 60 * 1000;

export default async () => {
  try {
    const now = Date.now();
    if (CACHED.payload && now - CACHED.at < TTL_MS) {
      return jsonResponse(200, CACHED.payload);
    }

    const [ownersResp, listingsResp] = await Promise.all([
      guestyFetch('/owners', { query: { limit: 500 } }),
      guestyFetch('/listings', {
        query: {
          limit: 500,
          fields: '_id title nickname owners owner',
        },
      }),
    ]);

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
    CACHED = { at: now, payload };
    return jsonResponse(200, payload);
  } catch (err) {
    return errorResponse(err);
  }
};

export const config = { path: '/api/owners-with-listings' };
