const ALBUM_IDS = /* CATALOG_IDS */ [];
const validIds = new Set(ALBUM_IDS);
const json = (data, status = 200) => Response.json(data, {status, headers: {'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'}});
class HttpError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
function idsFrom(value) {
  if (!Array.isArray(value) || value.length > ALBUM_IDS.length || value.some(id => !validIds.has(id))) throw new HttpError('Choose releases from the archive.');
  return [...new Set(value)];
}
async function bodyOf(request) {
  if (!request.headers.get('content-type')?.includes('application/json')) throw new HttpError('Send a JSON request.', 415);
  // Read with a limit even when the sender omits Content-Length.
  const reader = request.body?.getReader(); let bytes = 0, text = ''; const decoder = new TextDecoder();
  if (!reader) throw new HttpError('A request body is required.');
  while (true) { const chunk = await reader.read(); if (chunk.done) break; bytes += chunk.value.length;
    if (bytes > 8192) { await reader.cancel(); throw new HttpError('Request is too large.', 413); }
    text += decoder.decode(chunk.value, {stream: true});
  }
  try { const value = JSON.parse(text + decoder.decode()); if (!value || typeof value !== 'object' || Array.isArray(value)) throw 0; return value; }
  catch { throw new HttpError('The request is not valid JSON.'); }
}
async function statistics(db) {
  const [votes, total] = await Promise.all([db.prepare('SELECT album_id AS albumId, COUNT(*) AS votes FROM votes GROUP BY album_id').all(), db.prepare('SELECT COUNT(*) AS count FROM playlists').first()]);
  return {stats: votes.results, playlistCount: Number(total?.count || 0)};
}
async function api(request, env) {
  const url = new URL(request.url), path = url.pathname, method = request.method;
  if (!env.DB) throw new HttpError('The archive connection is unavailable. Please try again.', 503);
  // Sites supplies this identity after access checks. Never accept a user ID in request data.
  const user = request.headers.get('oai-authenticated-user-id');
  const publicRead = method === 'GET' && (path === '/api/state' || /^\/api\/playlists\/[0-9a-f-]{36}$/i.test(path));
  if (!user && !publicRead) throw new HttpError('Sign in with ChatGPT to save releases, vote or create a playlist.', 401);
  if (method !== 'GET' && method !== 'HEAD') {
    const origin = request.headers.get('origin');
    if ((origin && origin !== url.origin) || request.headers.get('sec-fetch-site') === 'cross-site') throw new HttpError('Open this action from the VIPERR site.', 403);
  }
  const db = env.DB, now = Date.now();
  if (path === '/api/state' && method === 'GET') {
    const [library, vote, stats] = await Promise.all([user ? db.prepare('SELECT saved_json FROM libraries WHERE user_id = ?').bind(user).first() : null, user ? db.prepare('SELECT album_id FROM votes WHERE user_id = ?').bind(user).first() : null, statistics(db)]);
    return json({authenticated: Boolean(user), saved: library ? JSON.parse(library.saved_json).filter(id => validIds.has(id)) : [], vote: vote?.album_id || null, ...stats});
  }
  if (path === '/api/saved' && method === 'PUT') {
    const ids = idsFrom((await bodyOf(request)).ids);
    await db.prepare('INSERT INTO libraries (user_id, saved_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET saved_json = excluded.saved_json, updated_at = excluded.updated_at').bind(user, JSON.stringify(ids), now).run();
    return json({saved: ids});
  }
  if (path === '/api/saved' && method === 'PATCH') {
    const input = await bodyOf(request), add = idsFrom(input.add || []), remove = idsFrom(input.remove || []);
    const initial = add.filter(id => !remove.includes(id));
    await db.prepare("INSERT INTO libraries (user_id, saved_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET saved_json = (SELECT json_group_array(value) FROM (SELECT value FROM json_each(libraries.saved_json) UNION SELECT value FROM json_each(?) EXCEPT SELECT value FROM json_each(?))), updated_at = excluded.updated_at").bind(user, JSON.stringify(initial), now, JSON.stringify(add), JSON.stringify(remove)).run();
    const row = await db.prepare('SELECT saved_json FROM libraries WHERE user_id = ?').bind(user).first();
    return json({saved: JSON.parse(row.saved_json)});
  }
  if (path === '/api/vote' && method === 'POST') {
    const {albumId} = await bodyOf(request); if (!validIds.has(albumId)) throw new HttpError('Choose a release from the archive.');
    await db.prepare('INSERT INTO votes (user_id, album_id, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET album_id = excluded.album_id, updated_at = excluded.updated_at').bind(user, albumId, now).run();
    return json({vote: albumId, ...await statistics(db)});
  }
  if (path === '/api/playlists' && method === 'POST') {
    const input = await bodyOf(request), ids = idsFrom(input.ids);
    const title = typeof input.title === 'string' ? input.title.trim() : '';
    if (!ids.length || !title || title.length > 60) throw new HttpError('Add at least one release and a title of up to 60 characters.');
    const id = input.id || crypto.randomUUID();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new HttpError('Invalid playlist identifier.');
    const existing = await db.prepare('SELECT owner_id, title, album_ids FROM playlists WHERE id = ?').bind(id).first();
    if (existing) {
      if (existing.owner_id === user && existing.title === title && existing.album_ids === JSON.stringify(ids)) return json({id, title, ids});
      throw new HttpError('This playlist identifier is already in use.', 409);
    }
    // Limit stored playlists atomically, including concurrent requests. Links are immutable snapshots.
    const inserted = await db.prepare('INSERT INTO playlists (id, owner_id, title, album_ids, created_at) SELECT ?, ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM playlists WHERE owner_id = ?) < 100 AND (SELECT COUNT(*) FROM playlists WHERE owner_id = ? AND created_at > ?) < 20 ON CONFLICT(id) DO NOTHING').bind(id, user, title, JSON.stringify(ids), now, user, user, now - 3600000).run();
    if (!inserted.meta.changes) {
      const retry = await db.prepare('SELECT owner_id, title, album_ids FROM playlists WHERE id = ?').bind(id).first();
      if (retry?.owner_id === user && retry.title === title && retry.album_ids === JSON.stringify(ids)) return json({id, title, ids});
      if (retry) throw new HttpError('This playlist identifier is already in use.', 409);
      throw new HttpError('Playlist limit reached. Keep your existing links or try again later.', 429);
    }
    return json({id, title, ids}, 201);
  }
  const playlist = /^\/api\/playlists\/([0-9a-f-]{36})$/i.exec(path);
  if (playlist && method === 'GET') {
    const row = await db.prepare('SELECT id, title, album_ids, created_at FROM playlists WHERE id = ?').bind(playlist[1]).first();
    if (!row) throw new HttpError('This playlist could not be found.', 404);
    return json({id: row.id, title: row.title, ids: JSON.parse(row.album_ids).filter(id => validIds.has(id)), createdAt: row.created_at});
  }
  if (['/api/state', '/api/saved', '/api/vote', '/api/playlists'].includes(path) || playlist) throw new HttpError('This action does not support that method.', 405);
  throw new HttpError('This archive action does not exist.', 404);
}
export default {async fetch(request, env) {
  if (!new URL(request.url).pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
  try { return await api(request, env); }
  catch (error) { if (!(error instanceof HttpError)) console.error('Archive request failed', error.message); return json({error: error instanceof HttpError ? error.message : 'Could not connect to the archive. Please try again.'}, error.status || 503); }
}};
