import { guestyFetch, sendJson, handleError } from './_guesty.js';

// Aggregates everything needed to render an owner statement view for one owner+period.
// Returns: { owner, listings, reservations, expenses, period }
export default async function handler(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const ownerId = url.searchParams.get('ownerId');
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    if (!ownerId || !from || !to) {
      return sendJson(res, 400, { error: 'ownerId, from, to are required' });
    }

    // 1. Owner profile
    const owner = await guestyFetch(`/owners/${ownerId}`).catch(() => null);

    // 2. Listings for that owner
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

    // 3. Reservations overlapping the period for those listings
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

    // 4. Expenses (best-effort — endpoint name varies; ignore failure)
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

    sendJson(res, 200, {
      period: { from, to },
      owner,
      listings,
      reservations,
      expenses,
    });
  } catch (err) {
    handleError(res, err);
  }
}
