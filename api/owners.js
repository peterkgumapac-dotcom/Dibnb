import { guestyFetch, sendJson, handleError } from './_guesty.js';

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const limit = url.searchParams.get('limit') || '100';
    const skip = url.searchParams.get('skip') || '0';

    const data = await guestyFetch('/owners', {
      query: { limit, skip },
    });
    sendJson(res, 200, data);
  } catch (err) {
    handleError(res, err);
  }
}
