// api/playlist.js — Vercel serverless function
// Fetches Tamil + English playlists from iptv-org and returns a merged M3U

const SOURCES = [
  {
    url: 'https://iptv-org.github.io/iptv/languages/tam.m3u',
    label: 'Tamil'
  },
  {
    url: 'https://iptv-org.github.io/iptv/languages/eng.m3u',
    label: 'English'
  },
  // Extra Tamil/Indian sources
  {
    url: 'https://iptv-org.github.io/iptv/countries/in.m3u',
    label: 'India'
  }
];

async function fetchM3U(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 StreamTV/1.0' }
  });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.text();
}

function parseChannels(text, sourceLabel) {
  const lines = text.split('\n');
  const channels = [];
  let meta = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith('#EXTINF:')) {
      meta = line;
    } else if (line && !line.startsWith('#') && meta) {
      channels.push({ meta, url: line, source: sourceLabel });
      meta = null;
    }
  }
  return channels;
}

function deduplicateChannels(channels) {
  const seen = new Set();
  return channels.filter(ch => {
    // Deduplicate by stream URL
    if (seen.has(ch.url)) return false;
    seen.add(ch.url);
    return true;
  });
}

function buildM3U(channels) {
  const lines = ['#EXTM3U x-tvg-url="" url-tvg="" m3u-type="M3U" refresh="3600"'];

  for (const ch of channels) {
    lines.push(ch.meta);
    lines.push(ch.url);
  }

  return lines.join('\n');
}

export default async function handler(req, res) {
  // CORS headers — allows your STB app or any browser to fetch this
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Cache for 1 hour in Vercel CDN
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600');
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');

  try {
    const results = await Promise.allSettled(
      SOURCES.map(s => fetchM3U(s.url).then(text => ({ text, label: s.label })))
    );

    let allChannels = [];

    for (const result of results) {
      if (result.status === 'fulfilled') {
        const channels = parseChannels(result.value.text, result.value.label);
        allChannels = allChannels.concat(channels);
      }
    }

    if (allChannels.length === 0) {
      return res.status(502).send('#EXTM3U\n# Error: Could not fetch any playlists');
    }

    // Deduplicate by URL
    const unique = deduplicateChannels(allChannels);

    const m3u = buildM3U(unique);

    return res.status(200).send(m3u);

  } catch (err) {
    console.error('Playlist error:', err);
    return res.status(500).send(`#EXTM3U\n# Error: ${err.message}`);
  }
}
