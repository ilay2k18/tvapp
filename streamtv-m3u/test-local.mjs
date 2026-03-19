// test-local.mjs
// Run this on YOUR PC: node test-local.mjs
// It fetches real data and shows you what groups exist + tests stream URLs

const TAM_URL = 'https://iptv-org.github.io/iptv/languages/tam.m3u';

async function main() {
  console.log('Fetching Tamil M3U...');
  const res = await fetch(TAM_URL);
  const text = await res.text();

  console.log('\n--- FIRST 500 CHARS (raw) ---');
  console.log(JSON.stringify(text.slice(0, 500)));

  console.log('\n--- LINE ENDINGS ---');
  const hasCRLF = text.includes('\r\n');
  console.log('CRLF (Windows):', hasCRLF);
  console.log('LF only:', !hasCRLF);

  console.log('\n--- FIRST 5 EXTINF LINES ---');
  const lines = text.split(/\r?\n/);
  let count = 0;
  for (const line of lines) {
    if (line.startsWith('#EXTINF') && count < 5) {
      console.log(line);
      count++;
    }
  }

  console.log('\n--- UNIQUE group-title VALUES ---');
  const groups = new Set();
  for (const line of lines) {
    const m = line.match(/group-title="([^"]*)"/i);
    if (m) groups.add(m[1]);
  }
  console.log([...groups].sort());

  console.log('\n--- TOTAL CHANNELS ---');
  const urls = lines.filter(l => l.startsWith('http'));
  console.log(urls.length);

  console.log('\n--- TEST FIRST 5 STREAM URLS ---');
  let tested = 0;
  for (const line of lines) {
    if (!line.startsWith('http') || tested >= 5) continue;
    tested++;
    try {
      const r = await fetch(line, { method: 'HEAD', signal: AbortSignal.timeout(4000) });
      console.log(r.status < 400 ? '✅ LIVE' : `❌ DEAD (${r.status})`, line.slice(0, 80));
    } catch {
      console.log('❌ TIMEOUT', line.slice(0, 80));
    }
  }
}

main().catch(console.error);
