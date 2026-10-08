VIPERR

Independent English fan website for Kai Angel and 9mice.
Requirements: Node.js 22.13+ and pnpm 11.25.0.
To run locally:
  pnpm install
  pnpm build
  pnpm dev
Open http://127.0.0.1:4173. The local preview uses a loopback-only development
identity and persistent SQLite data in ignored .local/dev.sqlite.
  node scripts/test-api.mjs
runs isolated API checks against an in-memory database after building.

Source: public/ (frontend), worker/ (Cloudflare Worker), db/schema.ts and
Drizzle-generated drizzle/ migrations. Build output: dist/client and
dist/server/index.js. Production uses the logical D1 binding DB and ASSETS.
Production identity is supplied by Sites (oai-authenticated-user-id), never
by a form or client-selected user ID. No local preview data is deployed.

Stack: HTML, CSS, vanilla JavaScript, GSAP 3.15.0 / ScrollTrigger,
Lenis 1.3.26. Animation dependencies are vendored in public/vendor.
https://github.com/greensock/GSAP
https://github.com/darkroomengineering/lenis
Design guidance applied from UI UX Pro Max (project-local .agents/skills):
https://github.com/nextlevelbuilder/ui-ux-pro-max-skill

Features: animated user-selected portrait, full/close framing and mouse
parallax, scroll reveals, smooth scrolling, pinned portrait sequence,
14 album/EP releases, artist filters, search, date ordering, release dialogs,
tracklists, 182 verified/source-matched platform and smart links, server-saved
libraries, list export, one changeable album vote per signed-in user,
community counts and immutable playlists shared by URL. The published site, community counts and shared playlists can be viewed
without signing in. Saving, voting and creating playlists require ChatGPT
sign-in through the platform; missing identity is rejected server-side.
Library UI uses atomic add/remove operations across tabs and devices.
Explicit WebMCP replacement replaces the entire saved list intentionally.
Playlists use idempotent creation, with 20/hour and 100 total per user limits.
Motion can be paused and respects prefers-reduced-motion.
The three video links lead to the artists' official YouTube videos.

Catalog verified 8 October 2026 against Apple Music, Spotify and Shazam.
Scope: albums/EPs under the Kai Angel and 9mice artist names, including
joint VIPERR records. Earlier aliases, deleted/unverified releases and
standalone singles are outside the verified 14-release discography.
Not a claim of exhaustive historical coverage under every prior alias.
The historical leads and source limitations are preserved in source JSON.
Shh! source lists 14 tracks but exposes 2-14; the missing track is not invented.
Russian track titles are transliterated for the English presentation;
original titles remain in the source JSON and linked music service.

Selected portrait: https://pin.it/1HjWl996o
Canonical source: https://www.pinterest.com/pin/597149231878441705/
Original photo preserved; hero uses an imagegen background-removal derivative.
Pinterest already labels the source image AI-modified. The hero animates a
photograph; it is not a 3D scan of the artists.

Artwork, photographs, videos and music belong to their respective owners.
This is an independent fan archive, without artist affiliation.
Source/provenance JSON files accompany this delivery.
Hosting project identity is in .openai/hosting.json.

Music-platform sources: viperr-platform-links.json and viperr-regional-links.json.
All 14 releases include Spotify, YouTube Music, Deezer and TIDAL. Regional
platforms appear only when a direct destination was found. Availability and
subscription requirements can differ by country and can change.

Two brief original English lyric fragments appear as animated typography:
LMFAO (9mice & Kai Angel): https://www.shazam.com/song/1767963928/lmfao
LIPSTICK (Kai Angel & 9mice): https://www.shazam.com/es-es/song/1889978893/lipstick
Nine quoted lyric words total, with attribution and source links in the UI.

Public website: https://viperr-archive.vercel.app
GitHub source: https://github.com/qwertl06ang/viperr

Vercel deployment
-----------------
The public frontend and API gateway run on Vercel Hobby. vercel.json selects
public/ and api/gateway.js without invoking the Cloudflare build. Set
VIPERR_PUBLIC_ORIGIN=https://viperr-archive.vercel.app in Vercel and Sites.
The existing Sites Worker retains D1 data and ChatGPT sign-in. The sign-in
journey briefly visits the original identity host, then returns to Vercel.
PKCE S256 + one-use five-minute codes connect the two hosts. Opaque sessions
last at most 30 days; only hashes are stored. Cookies are Secure/HttpOnly.
No database password or shared signing secret is embedded in the source.

Run node scripts/test-bridge.mjs after building for isolated bridge checks.
Pushes to GitHub main deploy the Vercel frontend/API automatically. Worker
or D1 schema changes also require a Sites backend deployment. The older
public URL remains available as a compatible entry point.