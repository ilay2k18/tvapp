// api/check.js — validates a stream URL and returns alive/dead
// Used by the playlist to filter dead streams

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { url } = req.query;
  if (!url) return res.status(400).json({ alive: false, error: 'No URL' });

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const r = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 StreamTV/1.0' }
    });
    clearTimeout(timeout);

    const alive = r.status < 400;
    return res.status(200).json({ alive, status: r.status });

  } catch {
    return res.status(200).json({ alive: false });
  }
}
