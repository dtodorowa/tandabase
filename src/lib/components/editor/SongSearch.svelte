<script lang="ts">
  import { searchYouTube, extractVideoId, getVideoById, type YTResult } from '$lib/utils/youtube';
  import type { Song } from '$lib/types';

  let { onadd }: { onadd: (song: Song) => void } = $props();

  let query = $state('');
  let urlInput = $state('');
  let results = $state<YTResult[]>([]);
  let loading = $state(false);
  let searched = $state(false);
  let searchError = $state('');
  let urlLoading = $state(false);
  let urlError = $state('');
  let mode = $state<'search' | 'url'>('search');
  let debounceTimer: ReturnType<typeof setTimeout>;

  function handleInput() {
    clearTimeout(debounceTimer);
    searchError = '';
    if (query.length < 3) {
      results = [];
      searched = false;
      return;
    }
    debounceTimer = setTimeout(async () => {
      loading = true;
      searched = true;
      try {
        results = await searchYouTube(query);
        if (results.length === 0) {
          searchError = 'No results — check browser console for API errors, or paste a URL instead.';
        }
      } catch (e: any) {
        results = [];
        searchError = e.message || 'Search failed — check browser console for details.';
      } finally {
        loading = false;
      }
    }, 300);
  }

  async function handleAddUrl() {
    urlError = '';
    const videoId = extractVideoId(urlInput);
    if (!videoId) {
      urlError = 'Could not extract a video ID. Paste a YouTube URL or 11-char video ID.';
      return;
    }
    urlLoading = true;
    try {
      const r = await getVideoById(videoId);
      if (r) {
        addResult(r);
        urlInput = '';
      } else {
        urlError = 'Video not found.';
      }
    } catch {
      urlError = 'Failed to look up video.';
    } finally {
      urlLoading = false;
    }
  }

  function addResult(r: YTResult) {
    const song: Song = {
      id: crypto.randomUUID(),
      title: r.title.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'"),
      singer: null,
      year: null,
      video_id: r.video_id,
      video_title: r.title,
      thumbnail: r.thumbnail || `https://img.youtube.com/vi/${r.video_id}/mqdefault.jpg`,
    };
    onadd(song);
  }
</script>

<div class="song-search">
  <div class="mode-tabs">
    <button class="tab" class:active={mode === 'search'} onclick={() => mode = 'search'}>Search</button>
    <button class="tab" class:active={mode === 'url'} onclick={() => mode = 'url'}>Paste URL</button>
  </div>

  {#if mode === 'search'}
    <input
      type="text"
      placeholder="Search YouTube for songs..."
      bind:value={query}
      oninput={handleInput}
    />
    {#if loading}
      <div class="search-status">Searching...</div>
    {:else if searchError}
      <div class="search-status error">{searchError}</div>
    {/if}
    {#if results.length > 0}
      <div class="search-results">
        {#each results as r}
          <button class="result-card" onclick={() => addResult(r)}>
            <img
              src={r.thumbnail || `https://img.youtube.com/vi/${r.video_id}/mqdefault.jpg`}
              alt=""
              class="result-thumb"
            />
            <div class="result-info">
              <div class="result-title">{@html r.title}</div>
              <div class="result-channel">{r.channel}</div>
            </div>
            <span class="add-btn">+</span>
          </button>
        {/each}
      </div>
    {/if}
  {:else}
    <div class="url-row">
      <input
        type="text"
        placeholder="Paste YouTube URL or video ID..."
        bind:value={urlInput}
        onkeydown={(e: KeyboardEvent) => e.key === 'Enter' && handleAddUrl()}
      />
      <button class="url-add-btn" onclick={handleAddUrl} disabled={urlLoading || !urlInput.trim()}>
        {urlLoading ? '...' : 'Add'}
      </button>
    </div>
    {#if urlError}
      <div class="search-status error">{urlError}</div>
    {/if}
    <div class="url-hint">
      Accepts: youtube.com/watch?v=..., youtu.be/..., or a video ID like <code>dQw4w9WgXcQ</code>
    </div>
  {/if}
</div>

<style>
  .song-search {
    margin-top: 0.5rem;
  }
  .song-search input {
    width: 100%;
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--text);
    border-radius: var(--radius-sm);
    padding: 0.5rem 0.75rem;
    font-size: 0.82rem;
  }
  .song-search input:focus { border-color: var(--accent); }
  .mode-tabs {
    display: flex;
    gap: 0.25rem;
    margin-bottom: 0.4rem;
  }
  .tab {
    background: var(--surface2);
    border: 1px solid var(--border);
    color: var(--text-dim);
    padding: 0.3rem 0.7rem;
    font-size: 0.7rem;
    font-weight: 500;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all 0.12s;
    font-family: 'Outfit', sans-serif;
  }
  .tab:hover { border-color: var(--accent); color: var(--accent); }
  .tab.active {
    background: var(--accent-dim);
    border-color: var(--accent);
    color: var(--accent);
  }
  .url-row {
    display: flex;
    gap: 0.35rem;
  }
  .url-row input { flex: 1; }
  .url-add-btn {
    background: var(--accent);
    color: var(--bg);
    border: none;
    padding: 0.5rem 0.9rem;
    font-size: 0.78rem;
    font-weight: 600;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all 0.12s;
    font-family: 'Outfit', sans-serif;
    white-space: nowrap;
  }
  .url-add-btn:hover:not(:disabled) { background: var(--accent-bright); }
  .url-add-btn:disabled { opacity: 0.5; cursor: default; }
  .url-hint {
    font-size: 0.65rem;
    color: var(--text-dim);
    padding: 0.35rem 0;
    line-height: 1.4;
  }
  .url-hint code {
    background: var(--surface2);
    padding: 0.1rem 0.3rem;
    border-radius: 3px;
    font-size: 0.62rem;
  }
  .search-status {
    font-size: 0.72rem;
    color: var(--text-dim);
    padding: 0.5rem 0;
  }
  .search-status.error {
    color: var(--tango);
  }
  .search-results {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin-top: 0.4rem;
    max-height: 300px;
    overflow-y: auto;
  }
  .result-card {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.4rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all 0.12s;
    text-align: left;
    color: var(--text);
    font-family: 'Outfit', sans-serif;
    width: 100%;
  }
  .result-card:hover {
    border-color: var(--accent);
    background: var(--accent-dim);
  }
  .result-thumb {
    width: 60px;
    height: 34px;
    object-fit: cover;
    border-radius: 3px;
    flex-shrink: 0;
  }
  .result-info { flex: 1; min-width: 0; }
  .result-title {
    font-size: 0.75rem;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .result-channel {
    font-size: 0.62rem;
    color: var(--text-dim);
  }
  .add-btn {
    font-size: 1.1rem;
    color: var(--accent);
    font-weight: 600;
    flex-shrink: 0;
    padding: 0 0.3rem;
  }
</style>
