import { getAccessToken, jsonResponse, errorResponse } from './_guesty.js';

export default async () => {
  try {
    const token = await getAccessToken();
    return jsonResponse(200, {
      ok: true,
      hasToken: Boolean(token),
      tokenPreview: token ? `${token.slice(0, 8)}…${token.slice(-4)}` : null,
      time: new Date().toISOString(),
    });
  } catch (err) {
    return errorResponse(err);
  }
};

export const config = { path: '/api/health' };
