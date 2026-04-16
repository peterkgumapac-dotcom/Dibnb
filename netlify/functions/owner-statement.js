import { guestyFetch, jsonResponse, errorResponse } from './_guesty.js';

// Aggregates everything needed to render an owner statement view for one owner+period.
// Returns: { period, owner, listings, reservations, expenses }
export default async (req) => {
  try {
    const url = new URL(req.url);
    const ownerId = url.searchParams.get('ownerId');
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    if (!ownerId || !from || !to) {
      return jsonResponse(400, { error: 'ownerId, from, to are required' });
    }

    const owner = await guestyFetch(`/owners/${ownerId}`).catch(() => null);

    const listingsResp = await guestyFetch('/listings', {
      query: {
        'filters[owner]': ownerId,
        limit: 100,
        fields: 'title nickname address accountingType owners pms.active terms.cancellation',
      },
    });
    const listings = Array.isArray(listingsResp?.results)
      ? listingsResp.results
      : Array.isArray(listingsResp)
      ? listingsResp
      : [];

    const listingIds = listings.map((l) => l._id || l.id).filter(Boolean);
    let reservations = [];
    if (listingIds.length) {
      const resvResp = await guestyFetch('/reservations', {
        query: {
          limit: 200,
          fields:
            '_id status source channel confirmationCode guest.fullName guest.email checkIn checkOut nightsCount listingId listing.title listing.nickname money createdAt cancelledAt',
          'filters[listingId][$in]': listingIds.join(','),
          'filters[checkIn][$lte]': to,
          'filters[checkOut][$gte]': from,
        },
      });
      reservations = Array.isArray(resvResp?.results) ? resvResp.results : [];
    }

    let expenses = [];
    try {
      const expResp = await guestyFetch('/expenses', {
        query: {
          'filters[owner]': ownerId,
          'filters[date][$gte]': from,
          'filters[date][$lte]': to,
          limit: 200,
        },
      });
      expenses = Array.isArray(expResp?.results) ? expResp.results : [];
    } catch {
      expenses = [];
    }

    // Pull Guesty's published owner statement(s) for the period — best-effort.
    // Endpoint shape varies by account; try the standard one then fall back silently.
    let publishedStatement = null;
    const tryQueries = [
      {
        path: '/owner-statements',
        query: {
          'filters[owner]': ownerId,
          'filters[period][$gte]': from,
          'filters[period][$lte]': to,
          limit: 5,
        },
      },
      {
        path: '/owner-statements',
        query: {
          'filters[ownerId]': ownerId,
          'filters[from]': from,
          'filters[to]': to,
          limit: 5,
        },
      },
      {
        path: `/owners/${ownerId}/statements`,
        query: { from, to, limit: 5 },
      },
    ];
    for (const t of tryQueries) {
      try {
        const resp = await guestyFetch(t.path, { query: t.query });
        const list = Array.isArray(resp?.results)
          ? resp.results
          : Array.isArray(resp)
          ? resp
          : null;
        if (list && list.length) {
          publishedStatement = list[0];
          break;
        }
      } catch {
        // try next shape
      }
    }

    return jsonResponse(200, {
      period: { from, to },
      owner,
      listings,
      reservations,
      expenses,
      publishedStatement,
    });
  } catch (err) {
    return errorResponse(err);
  }
};

export const config = { path: '/api/owner-statement' };
