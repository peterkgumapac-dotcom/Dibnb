import { guestyFetch, jsonResponse, errorResponse } from './_guesty.js';

export default async (req) => {
  try {
    const url = new URL(req.url);
    const limit = url.searchParams.get('limit') || '100';
    const skip = url.searchParams.get('skip') || '0';
    const ownerId = url.searchParams.get('ownerId');
    const fields =
      url.searchParams.get('fields') ||
      'title nickname address propertyType accountingType owners pms.active terms.cancellation';

    const query = { limit, skip, fields };
    if (ownerId) query['filters[owner]'] = ownerId;

    const data = await guestyFetch('/listings', { query });
    return jsonResponse(200, data);
  } catch (err) {
    return errorResponse(err);
  }
};

export const config = { path: '/api/listings' };
