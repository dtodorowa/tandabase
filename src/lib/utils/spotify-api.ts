/**
 * Spotify Web API helper — ported from Exportify's utils pattern.
 * Handles rate limiting (429), bad gateway retries (502), and token expiry (401).
 */

// ── Types ──

export interface SpotifyPlaylistSummary {
  id: string;
  name: string;
  owner: string;
  trackCount: number;
  imageUrl: string;
  externalUrl: string;
}

export interface SpotifyTrackItem {
  name: string;
  artists: { name: string; id: string }[];
  album: { name: string; release_date: string; id: string };
  duration_ms: number;
  uri: string;
  is_local: boolean;
}

// ── Token helpers ──

export function getSpotifyToken(): string | null {
  const token = localStorage.getItem('spotify_access_token');
  const timestamp = parseInt(localStorage.getItem('spotify_token_timestamp') ?? '0', 10);
  if (token && Date.now() - timestamp < 3600000) return token;
  return null;
}

export function clearSpotifyToken(): void {
  localStorage.removeItem('spotify_access_token');
  localStorage.removeItem('spotify_token_timestamp');
  localStorage.removeItem('spotify_code_verifier');
}

// ── Core API call (matching Exportify's utils.apiCall) ──

export async function spotifyApiCall<T = any>(
  url: string,
  token: string,
  delay = 0,
  badGatewayRetries = 2,
  rateLimitRetries = 3,
): Promise<T> {
  if (delay > 0) {
    await new Promise((r) => setTimeout(r, delay));
  }

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (response.ok) {
    return response.json();
  }

  if (response.status === 401) {
    clearSpotifyToken();
    throw new SpotifyAuthError('Spotify session expired. Please reconnect.');
  }

  if (response.status === 403) {
    clearSpotifyToken();
    throw new SpotifyForbiddenError(
      'SPOTIFY_DEV_MODE'
    );
  }

  if (response.status === 429) {
    if (rateLimitRetries <= 0) {
      throw new SpotifyRateLimitError(
        'Spotify rate limit exceeded. The app is in development mode with limited API quota — please wait a minute and try again.'
      );
    }
    const retryAfter = Math.max(parseInt(response.headers.get('Retry-After') ?? '2', 10), 2);
    const backoff = retryAfter * 1000 * (4 - rateLimitRetries); // exponential-ish backoff
    return spotifyApiCall<T>(url, token, backoff, badGatewayRetries, rateLimitRetries - 1);
  }

  if (response.status === 502 && badGatewayRetries > 0) {
    return spotifyApiCall<T>(url, token, (3 - badGatewayRetries) * 1000, badGatewayRetries - 1, rateLimitRetries);
  }

  throw new Error(`Spotify API error: HTTP ${response.status}`);
}

export class SpotifyAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SpotifyAuthError';
  }
}

export class SpotifyRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SpotifyRateLimitError';
  }
}

export class SpotifyForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SpotifyForbiddenError';
  }
}

// ── Fetch all user playlists (like Exportify's PlaylistTable.init) ──

export async function fetchAllUserPlaylists(token: string): Promise<SpotifyPlaylistSummary[]> {
  // First, get the user profile for liked songs
  const user = await spotifyApiCall<any>('https://api.spotify.com/v1/me', token);

  // Fetch liked songs count
  const library = await spotifyApiCall<any>(
    'https://api.spotify.com/v1/me/tracks?offset=0&limit=1',
    token,
  );

  const playlists: SpotifyPlaylistSummary[] = [];

  // Add "Liked Songs" as a pseudo-playlist
  if (library.total > 0) {
    playlists.push({
      id: '__liked_songs__',
      name: 'Liked Songs',
      owner: user.id,
      trackCount: library.total,
      imageUrl: '',
      externalUrl: 'https://open.spotify.com/collection/tracks',
    });
  }

  // Fetch first page of playlists
  const first = await spotifyApiCall<any>(
    'https://api.spotify.com/v1/me/playlists?limit=50&offset=0',
    token,
  );
  pushPlaylists(playlists, first.items);

  // Fetch remaining pages in parallel with staggered delays (like Exportify)
  const requests: Promise<any>[] = [];
  for (let offset = 50; offset < first.total; offset += 50) {
    requests.push(
      spotifyApiCall(
        `https://api.spotify.com/v1/me/playlists?limit=50&offset=${offset}`,
        token,
        2 * offset - 100,
      ),
    );
  }
  const responses = await Promise.all(requests);
  for (const resp of responses) {
    pushPlaylists(playlists, resp.items);
  }

  return playlists;
}

function pushPlaylists(out: SpotifyPlaylistSummary[], items: any[]): void {
  for (const p of items) {
    if (!p) continue;
    out.push({
      id: p.id,
      name: p.name ?? 'Untitled',
      owner: p.owner?.id ?? '',
      trackCount: p.tracks?.total ?? p.items?.total ?? 0,
      imageUrl: p.images?.[0]?.url ?? '',
      externalUrl: p.external_urls?.spotify ?? '',
    });
  }
}

// ── Fetch tracks for a specific playlist ──

export async function fetchPlaylistTracks(
  token: string,
  playlistId: string,
): Promise<{ name: string; description: string; tracks: SpotifyTrackItem[] }> {
  const isLiked = playlistId === '__liked_songs__';
  const increment = isLiked ? 50 : 100;

  // Fetch metadata (skip for liked songs)
  let name = 'Liked Songs';
  let description = '';
  let total = 0;

  // Spotify may return the tracks sub-object as "tracks" or "items" depending
  // on API version. Use the href it provides (like Exportify does) so we hit
  // the correct endpoint (/items vs /tracks).
  let tracksHref: string;

  if (isLiked) {
    const first = await spotifyApiCall<any>(
      'https://api.spotify.com/v1/me/tracks?offset=0&limit=1',
      token,
    );
    total = first.total;
    tracksHref = 'https://api.spotify.com/v1/me/tracks';
  } else {
    const meta = await spotifyApiCall<any>(
      `https://api.spotify.com/v1/playlists/${playlistId}`,
      token,
    );
    name = meta.name ?? '';
    description = meta.description ?? '';
    const tracksMeta = meta.tracks ?? meta.items ?? {};
    total = tracksMeta.total ?? 0;
    tracksHref = tracksMeta.href ?? `https://api.spotify.com/v1/playlists/${playlistId}/tracks`;
  }

  // Fetch all track pages in parallel with staggered delays (like Exportify)
  // Strip any existing query params from the href so we can append our own offset/limit
  const baseUrl = tracksHref.split('?')[0];

  const requests: Promise<any>[] = [];
  for (let offset = 0; offset < total; offset += increment) {
    requests.push(
      spotifyApiCall(
        `${baseUrl}?offset=${offset}&limit=${increment}`,
        token,
        (offset / increment) * 100,
      ),
    );
  }

  const responses = await Promise.all(requests);
  const tracks: SpotifyTrackItem[] = [];
  for (const resp of responses) {
    for (const item of resp.items ?? []) {
      if (item.is_local) continue;
      // Spotify API v1 used `item.track` (object); newer responses use `item.item`.
      // `item.track` may now be a boolean flag, so only use it if it's an object.
      const t =
        (item.item && typeof item.item === 'object' ? item.item : null) ??
        (item.track && typeof item.track === 'object' ? item.track : null);
      if (!t) continue;
      tracks.push({
        name: t.name,
        artists: (t.artists ?? []).map((a: any) => ({ name: a.name, id: a.id })),
        album: {
          name: t.album?.name ?? '',
          release_date: t.album?.release_date ?? '',
          id: t.album?.id ?? '',
        },
        duration_ms: t.duration_ms ?? 0,
        uri: t.uri ?? '',
        is_local: false,
      });
    }
  }

  return { name, description, tracks };
}
