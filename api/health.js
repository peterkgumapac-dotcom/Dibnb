import { sendJson, handleError, getAccessToken } from './_guesty.js';

export default async function handler(req, res) {
  try {
    const token = await getAccessToken();
    sendJson(res, 200, {
      ok: true,
      hasToken: Boolean(token),
      tokenPreview: token ? `${token.slice(0, 8)}…${token.slice(-4)}` : null,
      time: new Date().toISOString(),
    });
  } catch (err) {
    handleError(res, err);
  }
}
