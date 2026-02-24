const API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;
const BASE = 'https://www.googleapis.com/youtube/v3/search';

/** Default preferred channels for tango music (channel handles) */
export const DEFAULT_PREFERRED_CHANNELS = [
  'radiotangohires9388',
  'tangotimetravel',
];

const THROTTLE_MS = 150; // delay between API calls for batch operations

export interface YTResult {
  video_id: string;
  title: string;
  channel: string;
  thumbnail: string;
}

export async function searchYouTube(query: string, maxResults = 8): Promise<YTResult[]> {
  if (!API_KEY) {
    console.warn('[YouTube] No API key set (VITE_YOUTUBE_API_KEY)');
    return [];
  }

  const params = new URLSearchParams({
    part: 'snippet',
    q: query,
    type: 'video',
    maxResults: String(maxResults),
    key: API_KEY,
  });

  const url = `${BASE}?${params}`;
  const res = await fetch(url);

  if (!res.ok) {
    const body = await res.text();
    console.error(`[YouTube] Search failed (${res.status}):`, body);
    throw new Error(`YouTube search failed: ${res.status}`);
  }

  const data = await res.json();

  if (!data.items || data.items.length === 0) {
    console.log('[YouTube] No items returned for query:', query);
    return [];
  }

  return data.items.map((item: any) => ({
    video_id: item.id.videoId,
    title: item.snippet.title,
    channel: item.snippet.channelTitle,
    thumbnail: item.snippet.thumbnails?.medium?.url ?? `https://img.youtube.com/vi/${item.id.videoId}/mqdefault.jpg`,
  }));
}

/**
 * Extract a YouTube video ID from various URL formats.
 * Supports: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/embed/ID, youtube.com/shorts/ID
 */
export function extractVideoId(input: string): string | null {
  const trimmed = input.trim();

  // Already a bare video ID (11 chars, alphanumeric + dash/underscore)
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;

  try {
    const url = new URL(trimmed);
    // youtube.com/watch?v=ID
    if (url.searchParams.has('v')) return url.searchParams.get('v');
    // youtu.be/ID
    if (url.hostname === 'youtu.be') return url.pathname.slice(1).split('/')[0] || null;
    // youtube.com/embed/ID or /shorts/ID or /v/ID
    const match = url.pathname.match(/\/(embed|shorts|v)\/([a-zA-Z0-9_-]{11})/);
    if (match) return match[2];
  } catch {
    // not a URL
  }
  return null;
}

/**
 * Fetch video details by ID using the YouTube Data API.
 */
/**
 * Search YouTube within a specific channel.
 */
export async function searchYouTubeInChannel(
  query: string,
  channelId: string,
  maxResults = 1
): Promise<YTResult[]> {
  if (!API_KEY) return [];

  const params = new URLSearchParams({
    part: 'snippet',
    q: query,
    type: 'video',
    channelId,
    maxResults: String(maxResults),
    key: API_KEY,
  });

  try {
    const res = await fetch(`${BASE}?${params}`);
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.items?.length) return [];
    return data.items.map((item: any) => ({
      video_id: item.id.videoId,
      title: item.snippet.title,
      channel: item.snippet.channelTitle,
      thumbnail: item.snippet.thumbnails?.medium?.url ?? `https://img.youtube.com/vi/${item.id.videoId}/mqdefault.jpg`,
    }));
  } catch {
    return [];
  }
}

/**
 * Resolve a YouTube channel handle (e.g. "radiotangohires9388") to a channel ID.
 * Caches results for the session.
 */
const channelIdCache = new Map<string, string | null>();

export async function resolveChannelId(handle: string): Promise<string | null> {
  if (channelIdCache.has(handle)) return channelIdCache.get(handle) ?? null;
  if (!API_KEY) return null;

  try {
    const params = new URLSearchParams({
      q: handle,
      part: 'snippet',
      type: 'channel',
      maxResults: '1',
      key: API_KEY,
    });
    const res = await fetch(`${BASE}?${params}`);
    if (!res.ok) return null;
    const data = await res.json();
    const id = data.items?.[0]?.snippet?.channelId ?? null;
    channelIdCache.set(handle, id);
    return id;
  } catch {
    return null;
  }
}

export interface BatchSearchItem {
  query: string;
  index: number; // tanda index
  songIndex: number;
}

export interface BatchSearchResult {
  index: number;
  songIndex: number;
  result: YTResult | null;
  source: 'channel' | 'general' | 'not_found';
}

/**
 * Batch search YouTube for multiple songs with throttling.
 * Tries preferred channels first, then falls back to general search.
 */
export async function batchSearchYouTube(
  items: BatchSearchItem[],
  preferredChannelHandles: string[] = DEFAULT_PREFERRED_CHANNELS,
  onProgress?: (completed: number, total: number, current: BatchSearchResult) => void,
  abortSignal?: AbortSignal,
): Promise<BatchSearchResult[]> {
  if (!API_KEY) {
    console.warn('[YouTube] No API key — batch search skipped');
    return items.map(item => ({
      index: item.index,
      songIndex: item.songIndex,
      result: null,
      source: 'not_found' as const,
    }));
  }

  // Resolve preferred channel IDs
  const channelIds: string[] = [];
  for (const handle of preferredChannelHandles) {
    const id = await resolveChannelId(handle);
    if (id) channelIds.push(id);
  }
  console.log(`[YouTube] Resolved ${channelIds.length}/${preferredChannelHandles.length} preferred channels`);

  const results: BatchSearchResult[] = [];

  for (let i = 0; i < items.length; i++) {
    if (abortSignal?.aborted) break;

    const item = items[i];
    let found: YTResult | null = null;
    let source: 'channel' | 'general' | 'not_found' = 'not_found';

    // Try each preferred channel first
    for (const channelId of channelIds) {
      const channelResults = await searchYouTubeInChannel(item.query, channelId, 1);
      if (channelResults.length > 0) {
        found = channelResults[0];
        source = 'channel';
        break;
      }
      await sleep(THROTTLE_MS);
    }

    // Fall back to general search
    if (!found) {
      try {
        const generalResults = await searchYouTube(item.query, 1);
        if (generalResults.length > 0) {
          found = generalResults[0];
          source = 'general';
        }
      } catch {
        // quota or error — leave as not_found
      }
    }

    const batchResult: BatchSearchResult = {
      index: item.index,
      songIndex: item.songIndex,
      result: found,
      source,
    };
    results.push(batchResult);

    if (onProgress) {
      onProgress(i + 1, items.length, batchResult);
    }

    // Throttle between requests
    if (i < items.length - 1) {
      await sleep(THROTTLE_MS);
    }
  }

  return results;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function getVideoById(videoId: string): Promise<YTResult | null> {
  if (!API_KEY) {
    // Return a basic result without API call
    return {
      video_id: videoId,
      title: `YouTube Video (${videoId})`,
      channel: '',
      thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
    };
  }

  const params = new URLSearchParams({
    part: 'snippet',
    id: videoId,
    key: API_KEY,
  });

  try {
    const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`);
    if (!res.ok) {
      console.error(`[YouTube] Video lookup failed (${res.status})`);
      // Fallback: return basic info
      return {
        video_id: videoId,
        title: `YouTube Video (${videoId})`,
        channel: '',
        thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
      };
    }
    const data = await res.json();
    if (!data.items || data.items.length === 0) return null;
    const item = data.items[0];
    return {
      video_id: videoId,
      title: item.snippet.title,
      channel: item.snippet.channelTitle,
      thumbnail: item.snippet.thumbnails?.medium?.url ?? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
    };
  } catch (e) {
    console.error('[YouTube] Video lookup error:', e);
    return {
      video_id: videoId,
      title: `YouTube Video (${videoId})`,
      channel: '',
      thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
    };
  }
}
