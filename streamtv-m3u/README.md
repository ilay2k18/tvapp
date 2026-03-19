# StreamTV M3U Proxy

Merges Tamil + English + India channels from iptv-org into one M3U URL.
Hosted free on Vercel. Updates every hour automatically.

## Deploy to Vercel (5 minutes)

### Option 1 — Vercel website (no coding needed)

1. Go to https://vercel.com and sign up free
2. Click "Add New Project"
3. Click "Upload" and drag this entire folder
4. Click Deploy
5. Your M3U URL will be: https://YOUR-PROJECT.vercel.app/api/playlist

### Option 2 — Vercel CLI

```bash
npm install -g vercel
cd streamtv-m3u
vercel deploy --prod
```

## Your M3U URL after deploy

```
https://YOUR-PROJECT-NAME.vercel.app/api/playlist
```

Paste this URL into your STB app under:
Settings → Add Playlist → M3U URL

## What channels are included

- All Tamil language channels (tam.m3u) — ~100+ channels
- All English language channels (eng.m3u) — 1000+ channels  
- All India channels (in.m3u) — covers regional Tamil, Telugu, Hindi etc.
- Duplicates automatically removed
- Playlist refreshes from iptv-org every hour via Vercel CDN cache

## Notes

- Some streams may be offline — this is normal for free public IPTV
- iptv-org channels are publicly sourced and legal to use
- No subscription or payment needed
