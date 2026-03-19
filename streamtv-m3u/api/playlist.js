// api/playlist.js
// Fetches from iptv-org and returns a properly formatted M3U
// with Tamil / English / Movies / Series categories

const SOURCES = [
  // Tamil
  { url: 'https://iptv-org.github.io/iptv/languages/tam.m3u', forceCat: null },
  // India (covers Sun TV, Vijay, Zee Tamil, etc.)
  { url: 'https://iptv-org.github.io/iptv/countries/in.m3u',  forceCat: null },
  // English
  { url: 'https://iptv-org.github.io/iptv/languages/eng.m3u', forceCat: null },
  // Categories
  { url: 'https://iptv-org.github.io/iptv/categories/movies.m3u',       forceCat: 'Movie Channels' },
  { url: 'https://iptv-org.github.io/iptv/categories/series.m3u',       forceCat: 'Web Series & TV Shows' },
  { url: 'https://iptv-org.github.io/iptv/categories/news.m3u',         forceCat: 'News' },
  { url: 'https://iptv-org.github.io/iptv/categories/sports.m3u',       forceCat: 'Sports' },
  { url: 'https://iptv-org.github.io/iptv/categories/music.m3u',        forceCat: 'Music' },
  { url: 'https://iptv-org.github.io/iptv/categories/kids.m3u',         forceCat: 'Kids' },
  { url: 'https://iptv-org.github.io/iptv/categories/documentary.m3u',  forceCat: 'Documentary' },
  { url: 'https://iptv-org.github.io/iptv/categories/animation.m3u',    forceCat: 'Animation' },
];

// Keywords that identify Tamil content
const TAMIL_WORDS = ['tamil','sun tv','vijay','kalaignar','raj tv','jaya tv',
  'vendhar','polimer','puthuyugam','captain tv','adithya','sona tv','news7 tamil',
  'puthiya thalaimurai','thanthi tv','news18 tamil','zee tamil','star vijay',
  'isai aruvi','chithiram','kollywood'];

// Group priority order shown in STB app
const GROUP_ORDER = [
  'Tamil Live TV',
  'Tamil Movies',
  'Tamil Series & Serials',
  'India Live TV',
  'English Live TV',
  'English Movies',
  'English Series & Shows',
  'Movie Channels',
  'Web Series & TV Shows',
  'News',
  'Sports',
  'Music',
  'Kids',
  'Documentary',
  'Animation',
];

async function safeFetch(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 StreamTV/1.0' }
    });
    if (!res.ok) return '';
    return await res.text();
  } catch (e) {
    console.error('fetch failed', url, e.message);
    return '';
  }
}

function parseM3U(text, forceCat) {
  const entries = [];
  // Split on #EXTINF to get each channel block
  const blocks = text.split('#EXTINF:');

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];
    // First line is the EXTINF metadata, rest may be URL
    const newline = block.indexOf('\n');
    if (newline === -1) continue;

    const infoPart = block.substring(0, newline).trim();
    const rest     = block.substring(newline + 1).trim();

    // Extract URL — first non-empty, non-comment line
    let streamUrl = '';
    for (const line of rest.split('\n')) {
      const l = line.trim();
      if (l && !l.startsWith('#')) {
        streamUrl = l;
        break;
      }
    }

    if (!streamUrl || !streamUrl.startsWith('http')) continue;

    // Parse attributes from info line
    const getName  = () => { const m = infoPart.match(/,(.+)$/); return m ? m[1].trim() : 'Unknown'; };
    const getAttr  = (a) => { const m = infoPart.match(new RegExp(`${a}="([^"]*)"`,'i')); return m ? m[1].trim() : ''; };

    const name  = getName();
    const logo  = getAttr('tvg-logo');
    const tvgId = getAttr('tvg-id');
    const origGroup = getAttr('group-title');

    const group = resolveGroup(name, origGroup, forceCat);

    entries.push({ name, logo, tvgId, group, url: streamUrl });
  }

  return entries;
}

function resolveGroup(name, origGroup, forceCat) {
  const lower = name.toLowerCase();

  // Check if it's Tamil content
  const isTamil = TAMIL_WORDS.some(w => lower.includes(w));

  if (isTamil) {
    const og = origGroup.toLowerCase();
    if (og.includes('series') || og.includes('serial') || og.includes('show'))
      return 'Tamil Series & Serials';
    if (og.includes('movie') || og.includes('film') || og.includes('cinema'))
      return 'Tamil Movies';
    return 'Tamil Live TV';
  }

  // Use forceCat if provided (for category-specific sources)
  if (forceCat) return forceCat;

  // Map original group to our categories
  const og = (origGroup || '').toLowerCase();
  if (og.includes('series') || og.includes('serial')) return 'Web Series & TV Shows';
  if (og.includes('movie')  || og.includes('film'))   return 'Movie Channels';
  if (og.includes('news'))   return 'News';
  if (og.includes('sport'))  return 'Sports';
  if (og.includes('music'))  return 'Music';
  if (og.includes('kids') || og.includes('child') || og.includes('cartoon')) return 'Kids';
  if (og.includes('document')) return 'Documentary';
  if (og.includes('anim'))  return 'Animation';

  // Detect English vs India
  if (og.includes('india') || og.includes('hindi') || og.includes('telugu') ||
      og.includes('malayalam') || og.includes('kannada') || og.includes('bengali'))
    return 'India Live TV';

  return 'English Live TV';
}

function buildM3U(entries) {
  // Sort by group order, then alphabetically within group
  entries.sort((a, b) => {
    const ai = GROUP_ORDER.indexOf(a.group);
    const bi = GROUP_ORDER.indexOf(b.group);
    const ao = ai === -1 ? 99 : ai;
    const bo = bi === -1 ? 99 : bi;
    if (ao !== bo) return ao - bo;
    return a.name.localeCompare(b.name);
  });

  const lines = ['#EXTM3U'];

  for (const e of entries) {
    // Build clean EXTINF line — this format is what STB apps expect
    let inf = '#EXTINF:-1';
    if (e.tvgId) inf += ` tvg-id="${e.tvgId}"`;
    if (e.logo)  inf += ` tvg-logo="${e.logo}"`;
    inf += ` group-title="${e.group}"`;
    inf += `,${e.name}`;

    lines.push(inf);
    lines.push(e.url);
    // Empty line between entries — helps some STB parsers
    lines.push('');
  }

  return lines.join('\n');
}

function deduplicate(entries) {
  const seen = new Set();
  return entries.filter(e => {
    if (seen.has(e.url)) return false;
    seen.add(e.url);
    return true;
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  res.setHeader('Content-Type',  'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600');

  try {
    // Fetch all sources in parallel
    const texts = await Promise.all(SOURCES.map(s => safeFetch(s.url)));

    let all = [];
    for (let i = 0; i < SOURCES.length; i++) {
      if (texts[i]) {
        const parsed = parseM3U(texts[i], SOURCES[i].forceCat);
        all = all.concat(parsed);
      }
    }

    if (all.length === 0) {
      return res.status(502).send('#EXTM3U\n#EXTINF:-1 group-title="Error",No channels loaded\nhttp://error');
    }

    all = deduplicate(all);

    // Stats header
    const stats = GROUP_ORDER
      .map(g => `# ${g}: ${all.filter(e => e.group === g).length}`)
      .filter(s => !s.endsWith(': 0'))
      .join('\n');

    const m3u = '#EXTM3U\n' + stats + '\n\n' + buildM3U(all).split('\n').slice(1).join('\n');

    return res.status(200).send(m3u);

  } catch (err) {
    console.error(err);
    return res.status(500).send(`#EXTM3U\n# Error: ${err.message}`);
  }
}
