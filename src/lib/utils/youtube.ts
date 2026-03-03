const API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;
const BASE = 'https://www.googleapis.com/youtube/v3/search';

export class YouTubeQuotaError extends Error {
  constructor() {
    super('YouTube API quota exceeded');
    this.name = 'YouTubeQuotaError';
  }
}

/** Default preferred channels for tango music (channel handles) */
export const DEFAULT_PREFERRED_CHANNELS = [
  'radiotangohires9388'
];

const THROTTLE_MS = 150; // delay between API calls for batch operations

// ── Client-side quota tracker ──
// YouTube Data API search.list costs 100 units; daily quota is 10,000 → ~100 searches/day
const QUOTA_KEY = 'yt_quota';
const QUOTA_LIMIT = 100; // in search-equivalents (actual units / 100)

function getQuotaState(): { used: number; date: string } {
  try {
    const raw = localStorage.getItem(QUOTA_KEY);
    if (raw) {
      const state = JSON.parse(raw);
      const today = new Date().toISOString().slice(0, 10);
      if (state.date === today) return state;
    }
  } catch { /* ignore */ }
  return { used: 0, date: new Date().toISOString().slice(0, 10) };
}

function trackQuotaUsage(searches = 1) {
  const state = getQuotaState();
  state.used += searches;
  try { localStorage.setItem(QUOTA_KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

export function getQuotaRemaining(): number {
  return Math.max(0, QUOTA_LIMIT - getQuotaState().used);
}

export function getQuotaUsed(): number {
  return getQuotaState().used;
}

// ── Search result cache (localStorage, 7-day TTL) ──
const CACHE_KEY = 'yt_search_cache';
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CacheEntry {
  result: YTResult | null;
  ts: number;
}

function getSearchCache(): Record<string, CacheEntry> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {};
}

function getCachedResult(cacheKey: string): YTResult | null | undefined {
  const cache = getSearchCache();
  const entry = cache[cacheKey];
  if (!entry) return undefined; // cache miss
  if (Date.now() - entry.ts > CACHE_TTL) return undefined; // expired
  return entry.result; // may be null (meaning "not found" was cached)
}

function setCachedResult(cacheKey: string, result: YTResult | null) {
  try {
    const cache = getSearchCache();
    // Evict expired entries to keep cache size manageable
    const now = Date.now();
    for (const key of Object.keys(cache)) {
      if (now - cache[key].ts > CACHE_TTL) delete cache[key];
    }
    cache[cacheKey] = { result, ts: now };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch { /* quota exceeded — ignore */ }
}

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
  trackQuotaUsage(1);

  if (!res.ok) {
    const body = await res.text();
    console.error(`[YouTube] Search failed (${res.status}):`, body);
    if (res.status === 403 && body.includes('quotaExceeded')) {
      throw new YouTubeQuotaError();
    }
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
    trackQuotaUsage(1);
    if (!res.ok) {
      if (res.status === 403) {
        const body = await res.text();
        if (body.includes('quotaExceeded')) throw new YouTubeQuotaError();
      }
      return [];
    }
    const data = await res.json();
    if (!data.items?.length) return [];
    return data.items.map((item: any) => ({
      video_id: item.id.videoId,
      title: item.snippet.title,
      channel: item.snippet.channelTitle,
      thumbnail: item.snippet.thumbnails?.medium?.url ?? `https://img.youtube.com/vi/${item.id.videoId}/mqdefault.jpg`,
    }));
  } catch (e) {
    if (e instanceof YouTubeQuotaError) throw e;
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
    // Use channels.list with forHandle — costs 1 unit instead of 100 (search.list)
    const params = new URLSearchParams({
      part: 'id',
      forHandle: `@${handle}`,
      key: API_KEY,
    });
    const res = await fetch(`https://www.googleapis.com/youtube/v3/channels?${params}`);
    if (!res.ok) return null;
    const data = await res.json();
    const id = data.items?.[0]?.id ?? null;
    channelIdCache.set(handle, id);
    return id;
  } catch {
    return null;
  }
}

/**
 * Estimate how many API searches a batch will cost (accounting for cache hits).
 * Each uncached song costs up to (1 + numChannels) searches in worst case.
 * Returns { uncached, worstCase, cached } counts.
 */
export function estimateBatchCost(
  queries: string[],
  numPreferredChannels = DEFAULT_PREFERRED_CHANNELS.length,
): { uncached: number; worstCase: number; cached: number } {
  let cached = 0;
  let uncached = 0;
  for (const q of queries) {
    if (getCachedResult(q) !== undefined) {
      cached++;
    } else {
      uncached++;
    }
  }
  // Worst case per uncached song: channel searches + 1 general fallback
  const worstCase = uncached * (numPreferredChannels + 1);
  return { uncached, worstCase, cached };
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

    // Check cache first — avoids all API calls for repeated queries
    const cached = getCachedResult(item.query);
    if (cached !== undefined) {
      found = cached;
      source = cached ? 'channel' : 'not_found';
    } else {
      // Try each preferred channel first
      try {
        for (const channelId of channelIds) {
          const channelResults = await searchYouTubeInChannel(item.query, channelId, 1);
          if (channelResults.length > 0) {
            found = channelResults[0];
            source = 'channel';
            break;
          }
          await sleep(THROTTLE_MS);
        }
      } catch (e) {
        if (e instanceof YouTubeQuotaError) throw e;
      }

      // Fall back to general search
      if (!found) {
        try {
          const generalResults = await searchYouTube(item.query, 1);
          if (generalResults.length > 0) {
            found = generalResults[0];
            source = 'general';
          }
        } catch (e) {
          if (e instanceof YouTubeQuotaError) throw e;
          // other error — leave as not_found
        }
      }

      // Cache the result (even null = "not found")
      setCachedResult(item.query, found);
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

    // Throttle between requests (skip if result was cached)
    if (i < items.length - 1 && cached === undefined) {
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
