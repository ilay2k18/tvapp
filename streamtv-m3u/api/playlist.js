// api/playlist.js — StreamTV M3U Proxy v3
// Fixes: proper group-title, stream health check, correct M3U format for STB Emu

const SOURCES = [
  { url: 'https://iptv-org.github.io/iptv/languages/tam.m3u',           defaultCat: 'Tamil Live TV' },
  { url: 'https://iptv-org.github.io/iptv/countries/in.m3u',            defaultCat: 'India Live TV' },
  { url: 'https://iptv-org.github.io/iptv/languages/eng.m3u',           defaultCat: 'English Live TV' },
  { url: 'https://iptv-org.github.io/iptv/categories/movies.m3u',       defaultCat: 'Movie Channels' },
  { url: 'https://iptv-org.github.io/iptv/categories/series.m3u',       defaultCat: 'Web Series & Shows' },
  { url: 'https://iptv-org.github.io/iptv/categories/news.m3u',         defaultCat: 'News' },
  { url: 'https://iptv-org.github.io/iptv/categories/sports.m3u',       defaultCat: 'Sports' },
  { url: 'https://iptv-org.github.io/iptv/categories/music.m3u',        defaultCat: 'Music' },
  { url: 'https://iptv-org.github.io/iptv/categories/kids.m3u',         defaultCat: 'Kids' },
  { url: 'https://iptv-org.github.io/iptv/categories/documentary.m3u',  defaultCat: 'Documentary' },
  { url: 'https://iptv-org.github.io/iptv/categories/animation.m3u',    defaultCat: 'Animation' },
];

// Tamil channel name/id patterns
const TAMIL_RE = /tamil|sun\s*tv|vijay|kalaignar|raj\s*tv|jaya\s*tv|vendhar|polimer|puthuyugam|captain\s*tv|adithya|sona\s*tv|news7\s*tamil|puthiya|thanthi|zee\s*tamil|star\s*vijay|isai|chithiram|kstv|aruvi|makkal|thirai|ayngaran/i;

const GROUP_ORDER = [
  'Tamil Live TV',
  'Tamil Movies',
  'Tamil Series & Serials',
  'India Live TV',
  'English Live TV',
  'English Movies',
  'English Series & Shows',
  'Movie Channels',
  'Web Series & Shows',
  'News',
  'Sports',
  'Music',
  'Kids',
  'Documentary',
  'Animation',
];

// ── Fetch helpers ──────────────────────────────────────────────────────────

async function safeFetch(url) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 StreamTV/1.0' }
    });
    clearTimeout(timer);
    if (!res.ok) return '';
    return await res.text();
  } catch {
    return '';
  }
}

async function checkStream(url) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(url, {
      method: 'HEAD',
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 StreamTV/1.0' }
    });
    clearTimeout(timer);
    return res.status < 400;
  } catch {
    return false;
  }
}

// ── Parser ─────────────────────────────────────────────────────────────────

function parseM3U(text, defaultCat) {
  const channels = [];
  // Normalize line endings
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  let inf = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith('#EXTINF:')) {
      inf = line;
      continue;
    }

    if (inf && line.startsWith('http')) {
      const name    = parseName(inf);
      const logo    = parseAttr(inf, 'tvg-logo');
      const tvgId   = parseAttr(inf, 'tvg-id');
      const origGrp = parseAttr(inf, 'group-title');
      const group   = assignGroup(name, tvgId, origGrp, defaultCat);

      channels.push({ name, logo, tvgId, group, url: line });
      inf = null;
    } else if (line.startsWith('#')) {
      // skip other directives but don't reset inf
      continue;
    } else {
      inf = null; // non-http non-comment = reset
    }
  }

  return channels;
}

function parseAttr(line, attr) {
  const m = line.match(new RegExp(attr + '="([^"]*)"', 'i'));
  return m ? m[1].trim() : '';
}

function parseName(line) {
  const m = line.match(/,(.+)$/);
  return m ? m[1].trim() : 'Unknown';
}

function assignGroup(name, tvgId, origGrp, defaultCat) {
  const key = (name + ' ' + tvgId + ' ' + origGrp).toLowerCase();

  // Tamil detection — highest priority
  if (TAMIL_RE.test(name) || TAMIL_RE.test(tvgId)) {
    const og = origGrp.toLowerCase();
    if (og.includes('series') || og.includes('serial') || og.includes('drama'))
      return 'Tamil Series & Serials';
    if (og.includes('movie') || og.includes('film') || og.includes('cinema'))
      return 'Tamil Movies';
    return 'Tamil Live TV';
  }

  // Map iptv-org group names to our categories
  const og = origGrp.toLowerCase();

  if (og === 'news' || og.includes('news'))                                   return 'News';
  if (og === 'sports' || og.includes('sport'))                                return 'Sports';
  if (og === 'music' || og.includes('music'))                                 return 'Music';
  if (og === 'kids' || og.includes('kids') || og.includes('children'))        return 'Kids';
  if (og.includes('movie') || og.includes('film') || og.includes('cinema'))   return defaultCat === 'Movie Channels' ? 'Movie Channels' : 'English Movies';
  if (og.includes('series') || og.includes('serial') || og.includes('show'))  return defaultCat === 'Web Series & Shows' ? 'Web Series & Shows' : 'English Series & Shows';
  if (og.includes('document'))                                                 return 'Documentary';
  if (og.includes('anim') || og.includes('cartoon'))                          return 'Animation';

  // India regional languages
  if (key.includes('hindi') || key.includes('telugu') || key.includes('malayalam') ||
      key.includes('kannada') || key.includes('bengali') || key.includes('marathi') ||
      key.includes('punjabi') || key.includes('india'))                        return 'India Live TV';

  // Fall back to source default
  return defaultCat;
}

// ── Stream validation ──────────────────────────────────────────────────────

async function filterDeadStreams(channels) {
  // Check up to 300 streams concurrently in batches
  // Skip check for channels that are clearly major known channels
  const KNOWN_GOOD_RE = /sun\s*tv|vijay|zee|star|sony|colors|ndtv|bbc|cnn|sky|fox|espn|disney/i;

  const toCheck = channels.filter(c => !KNOWN_GOOD_RE.test(c.name));
  const skip    = channels.filter(c =>  KNOWN_GOOD_RE.test(c.name));

  // Check in batches of 50
  const BATCH = 50;
  const alive = [...skip]; // major channels assumed live

  for (let i = 0; i < toCheck.length; i += BATCH) {
    const batch = toCheck.slice(i, i + BATCH);
    const results = await Promise.all(batch.map(c => checkStream(c.url)));
    for (let j = 0; j < batch.length; j++) {
      if (results[j]) alive.push(batch[j]);
    }
  }

  return alive;
}

// ── Build M3U ──────────────────────────────────────────────────────────────

function buildM3U(channels) {
  // Sort by group order then name
  channels.sort((a, b) => {
    const ai = GROUP_ORDER.indexOf(a.group);
    const bi = GROUP_ORDER.indexOf(b.group);
    const ao = ai < 0 ? 99 : ai;
    const bo = bi < 0 ? 99 : bi;
    if (ao !== bo) return ao - bo;
    return a.name.localeCompare(b.name);
  });

  // STB Emu / Smart IPTV compatible M3U format
  const lines = ['#EXTM3U'];

  for (const ch of channels) {
    let inf = '#EXTINF:-1';
    if (ch.tvgId) inf += ` tvg-id="${ch.tvgId}"`;
    if (ch.logo)  inf += ` tvg-logo="${ch.logo}"`;
    // group-title MUST be present and non-empty for category nav to work
    inf += ` group-title="${ch.group}"`;
    inf += `,${ch.name}`;

    lines.push(inf);
    lines.push(ch.url);
  }

  return lines.join('\n');
}

function dedupe(channels) {
  const seen = new Set();
  return channels.filter(c => {
    if (seen.has(c.url)) return false;
    seen.add(c.url);
    return true;
  });
}

// ── Handler ────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type',  'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const validate = req.query.validate === '1'; // ?validate=1 to enable stream checking

  try {
    // Fetch all sources in parallel
    const texts = await Promise.all(SOURCES.map(s => safeFetch(s.url)));

    let all = [];
    for (let i = 0; i < SOURCES.length; i++) {
      if (texts[i]) {
        all = all.concat(parseM3U(texts[i], SOURCES[i].defaultCat));
      }
    }

    if (all.length === 0) {
      return res.status(502).send('#EXTM3U\n#EXTINF:-1 group-title="Error",Could not load channels\nhttp://0.0.0.0');
    }

    all = dedupe(all);

    // Optionally filter dead streams (slow — only on ?validate=1)
    if (validate) {
      all = await filterDeadStreams(all);
    }

    const m3u = buildM3U(all);

    // Log stats
    const stats = GROUP_ORDER.map(g => {
      const n = all.filter(c => c.group === g).length;
      return n > 0 ? `${g}: ${n}` : null;
    }).filter(Boolean).join(', ');
    console.log(`Serving ${all.length} channels. ${stats}`);

    return res.status(200).send(m3u);

  } catch (err) {
    console.error(err);
    return res.status(500).send(`#EXTM3U\n# Error: ${err.message}`);
  }
}
