import { guestyFetch, jsonResponse, errorResponse } from './_guesty.js';

export default async (req) => {
  try {
    const url = new URL(req.url);
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const ownerId = url.searchParams.get('ownerId');
    const listingId = url.searchParams.get('listingId');
    const limit = url.searchParams.get('limit') || '100';
    const skip = url.searchParams.get('skip') || '0';

    if (!from || !to) {
      return jsonResponse(400, { error: 'from and to (YYYY-MM-DD) are required' });
    }

    const fields = [
      '_id status source channel confirmationCode',
      'guest.fullName guest.email',
      'checkIn checkOut nightsCount',
      'listingId listing.title listing.nickname',
      'money',
      'integration createdAt cancelledAt',
    ].join(' ');

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
    return jsonResponse(200, data);
  } catch (err) {
    return errorResponse(err);
  }
};

export const config = { path: '/api/reservations' };
