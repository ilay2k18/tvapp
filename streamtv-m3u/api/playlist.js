// api/playlist.js — StreamTV M3U Proxy
// Categories: Tamil Live, English Live, India Live, Tamil Movies,
// English Movies, Tamil Series, English Series, News, Sports, Kids, Music

const SOURCES = [
  { url: 'https://iptv-org.github.io/iptv/languages/tam.m3u',    cat: 'Tamil Live TV' },
  { url: 'https://iptv-org.github.io/iptv/countries/in.m3u',     cat: 'India Live TV' },
  { url: 'https://iptv-org.github.io/iptv/languages/eng.m3u',    cat: 'English Live TV' },
  { url: 'https://iptv-org.github.io/iptv/categories/news.m3u',  cat: 'News' },
  { url: 'https://iptv-org.github.io/iptv/categories/sports.m3u',cat: 'Sports' },
  { url: 'https://iptv-org.github.io/iptv/categories/kids.m3u',  cat: 'Kids' },
  { url: 'https://iptv-org.github.io/iptv/categories/movies.m3u',cat: 'Movie Channels' },
  { url: 'https://iptv-org.github.io/iptv/categories/music.m3u', cat: 'Music' },
  { url: 'https://iptv-org.github.io/iptv/categories/series.m3u',cat: 'Web Series & TV Shows' },
  { url: 'https://iptv-org.github.io/iptv/categories/documentary.m3u', cat: 'Documentary' },
  { url: 'https://iptv-org.github.io/iptv/categories/animation.m3u',   cat: 'Animation' },
];

// Tamil channel name keywords — force these into Tamil Live TV group
const TAMIL_KEYWORDS = [
  'sun tv','vijay','zee tamil','kalaignar','raj tv','jaya tv','vendhar',
  'polimer','puthuyugam','captain','adithya','isai aruvi','sona','et now tamil',
  'news18 tamil','news7 tamil','puthiya thalaimurai','thanthi','tamil'
];

// Movie/series keywords to detect VOD-style entries
const MOVIE_KEYWORDS = [
  'movie','film','cinema','cine','flick','latest','new release','collection',
  'blockbuster','hollywood','bollywood','kollywood','tollywood','hd movies',
  'prime movies','star movies','zee movies','sony max'
];
const SERIES_KEYWORDS = [
  'series','serial','episode','web series','season','show','drama','soap',
  'sitcom','netflix','amazon prime','hotstar','zee5','sony liv','aha'
];

async function fetchM3U(source) {
  try {
    const res = await fetch(source.url, {
      headers: { 'User-Agent': 'Mozilla/5.0 StreamTV/1.0' },
      signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) return [];
    const text = await res.text();
    return parseM3U(text, source.cat);
  } catch {
    return [];
  }
}

function parseM3U(text, defaultCat) {
  const lines = text.split('\n');
  const channels = [];
  let meta = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (line.startsWith('#EXTINF:')) {
      meta = line;
    } else if (line.startsWith('http') && meta) {
      const name    = extractAttr(meta, 'name') || extractInlineName(meta);
      const logo    = extractAttr(meta, 'tvg-logo');
      const tvgId   = extractAttr(meta, 'tvg-id');
      const origGrp = extractAttr(meta, 'group-title') || '';

      // Determine best category
      const group = resolveGroup(name, origGrp, defaultCat);

      // Rebuild clean EXTINF line with correct group-title
      const cleanMeta = buildExtinf(name, logo, tvgId, group);

      channels.push({ name, group, meta: cleanMeta, url: line });
      meta = null;
    }
  }
  return channels;
}

function extractAttr(line, attr) {
  const rx = new RegExp(`${attr}="([^"]*)"`, 'i');
  const m = line.match(rx);
  return m ? m[1].trim() : null;
}

function extractInlineName(line) {
  const m = line.match(/,(.+)$/);
  return m ? m[1].trim() : 'Unknown';
}

function resolveGroup(name, origGroup, defaultCat) {
  const lower = (name + ' ' + origGroup).toLowerCase();

  // Tamil detection — override group to Tamil Live TV
  if (TAMIL_KEYWORDS.some(k => lower.includes(k))) {
    if (SERIES_KEYWORDS.some(k => lower.includes(k))) return 'Tamil Web Series & Serials';
    if (MOVIE_KEYWORDS.some(k => lower.includes(k)))  return 'Tamil Movies';
    return 'Tamil Live TV';
  }

  // Series / VOD detection
  if (SERIES_KEYWORDS.some(k => lower.includes(k))) {
    if (lower.includes('tamil')) return 'Tamil Web Series & Serials';
    return 'English Series & Shows';
  }
  if (MOVIE_KEYWORDS.some(k => lower.includes(k))) {
    if (lower.includes('tamil') || lower.includes('kollywood')) return 'Tamil Movies';
    return 'English Movies & Cinema';
  }

  // Use original group-title if it's meaningful
  if (origGroup && origGroup.length > 1 && origGroup !== 'Undefined') {
    // Rename some common iptv-org group names to friendlier ones
    const g = origGroup.toLowerCase();
    if (g.includes('news'))    return 'News';
    if (g.includes('sport'))   return 'Sports';
    if (g.includes('kids') || g.includes('child')) return 'Kids';
    if (g.includes('music'))   return 'Music';
    if (g.includes('movie') || g.includes('film')) return 'Movie Channels';
    if (g.includes('series') || g.includes('show')) return 'Web Series & TV Shows';
    if (g.includes('documenta')) return 'Documentary';
    if (g.includes('anim'))    return 'Animation';
    return origGroup; // keep original if none matched
  }

  return defaultCat;
}

function buildExtinf(name, logo, tvgId, group) {
  let line = '#EXTINF:-1';
  if (tvgId) line += ` tvg-id="${tvgId}"`;
  if (logo)  line += ` tvg-logo="${logo}"`;
  line += ` group-title="${group}"`;
  line += `,${name}`;
  return line;
}

function deduplicate(channels) {
  const seenUrls  = new Set();
  const seenNames = new Map(); // name -> count (allow up to 1 per group)

  return channels.filter(ch => {
    if (seenUrls.has(ch.url)) return false;
    seenUrls.add(ch.url);
    return true;
  });
}

// Sort channels: Tamil first, then India, then English, then rest alphabetically
const GROUP_ORDER = [
  'Tamil Live TV',
  'Tamil Movies',
  'Tamil Web Series & Serials',
  'India Live TV',
  'English Live TV',
  'English Movies & Cinema',
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

function sortChannels(channels) {
  return channels.sort((a, b) => {
    const ai = GROUP_ORDER.indexOf(a.group);
    const bi = GROUP_ORDER.indexOf(b.group);
    const ao = ai === -1 ? 999 : ai;
    const bo = bi === -1 ? 999 : bi;
    if (ao !== bo) return ao - bo;
    return a.name.localeCompare(b.name);
  });
}

function buildM3U(channels) {
  const lines = ['#EXTM3U'];
  for (const ch of channels) {
    lines.push(ch.meta);
    lines.push(ch.url);
  }
  return lines.join('\n');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600');

  try {
    // Fetch all sources in parallel
    const results = await Promise.all(SOURCES.map(fetchM3U));

    let all = results.flat();

    if (all.length === 0) {
      return res.status(502).send('#EXTM3U\n# Error: Could not fetch any playlists');
    }

    all = deduplicate(all);
    all = sortChannels(all);

    // Summary comment at top
    const groups = [...new Set(all.map(c => c.group))];
    const summary = groups.map(g => {
      const count = all.filter(c => c.group === g).length;
      return `# ${g}: ${count} entries`;
    }).join('\n');

    const m3u = `#EXTM3U\n${summary}\n\n` + all.map(ch => `${ch.meta}\n${ch.url}`).join('\n');

    return res.status(200).send(m3u);

  } catch (err) {
    return res.status(500).send(`#EXTM3U\n# Error: ${err.message}`);
  }
}
