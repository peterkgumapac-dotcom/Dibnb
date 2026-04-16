import { guestyFetch, jsonResponse, errorResponse } from './_guesty.js';

export default async (req) => {
  try {
    const url = new URL(req.url);
    const limit = url.searchParams.get('limit') || '100';
    const skip = url.searchParams.get('skip') || '0';
    const data = await guestyFetch('/owners', { query: { limit, skip } });
    return jsonResponse(200, data);
  } catch (err) {
    return errorResponse(err);
  }
};

export const config = { path: '/api/owners' };
