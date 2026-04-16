import { guestyFetch, sendJson, handleError } from './_guesty.js';

// Pulls reservations whose check-in OR check-out falls within the period.
// Used by the dashboard as the source of truth for the owner statement view.
export default async function handler(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const from = url.searchParams.get('from'); // YYYY-MM-DD
    const to = url.searchParams.get('to');
    const ownerId = url.searchParams.get('ownerId');
    const listingId = url.searchParams.get('listingId');
    const limit = url.searchParams.get('limit') || '100';
    const skip = url.searchParams.get('skip') || '0';

    if (!from || !to) {
      return sendJson(res, 400, { error: 'from and to (YYYY-MM-DD) are required' });
    }

    const fields = [
      '_id status source channel confirmationCode',
      'guest.fullName guest.email',
      'checkIn checkOut nightsCount',
      'listingId listing.title listing.nickname',
      'money',
      'integration createdAt cancelledAt',
    ].join(' ');

    // Guesty supports filters[checkIn][$gte] etc. We pull anything overlapping the period.
    const query = {
      limit,
      skip,
      fields,
      'filters[checkIn][$lte]': to,
      'filters[checkOut][$gte]': from,
    };
    if (listingId) query['filters[listingId]'] = listingId;
    if (ownerId) query['filters[owner]'] = ownerId;

    const data = await guestyFetch('/reservations', { query });
    sendJson(res, 200, data);
  } catch (err) {
    handleError(res, err);
  }
}
