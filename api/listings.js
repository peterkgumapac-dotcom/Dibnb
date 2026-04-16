import { guestyFetch, sendJson, handleError } from './_guesty.js';

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const limit = url.searchParams.get('limit') || '100';
    const skip = url.searchParams.get('skip') || '0';
    const ownerId = url.searchParams.get('ownerId');
    const fields =
      url.searchParams.get('fields') ||
      'title nickname address propertyType accountingType owners pms.active terms.cancellation';

    const query = { limit, skip, fields };
    if (ownerId) query['filters[owner]'] = ownerId;

    const data = await guestyFetch('/listings', { query });
    sendJson(res, 200, data);
  } catch (err) {
    handleError(res, err);
  }
}
