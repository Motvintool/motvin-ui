// Vercel serverless function: fetches an arbitrary site server-side so the
// browser never has to deal with CORS at all (this request is same-origin
// from the client's point of view). Used by MOTVIN's "URL (Beta)" Fetch
// Site feature as the primary path, with public CORS proxies kept as a
// fallback for deployments where this function isn't available.
// Mirrors /api/fetch-site.js at the repo root — this copy exists because
// MOTVIN carries its own vercel.json and may be deployed as a standalone
// project with MOTVIN/ as its root, in which case only this copy ships.
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  const targetUrl = typeof req.query?.url === 'string' ? req.query.url : '';
  if (!targetUrl) {
    res.status(400).json({ error: 'Missing "url" query parameter.' });
    return;
  }

  let parsed;
  try {
    parsed = new URL(targetUrl);
  } catch {
    res.status(400).json({ error: 'Invalid URL.' });
    return;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    res.status(400).json({ error: 'Only http/https URLs are supported.' });
    return;
  }

  try {
    const upstream = await fetch(parsed.toString(), {
      redirect: 'follow',
      signal: AbortSignal.timeout(25000),
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; MotvinURLBetaFetcher/1.0; +https://motvin.app)',
        Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
      },
    });

    const contentType = upstream.headers.get('content-type') || 'text/html; charset=utf-8';
    const text = await upstream.text();

    res.setHeader('Content-Type', contentType);
    res.status(upstream.status).send(text);
  } catch (error) {
    res.status(502).json({
      error: `Upstream fetch failed: ${error?.message || 'unknown error'}`,
    });
  }
}
