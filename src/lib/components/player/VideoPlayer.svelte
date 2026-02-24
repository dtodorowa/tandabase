<script lang="ts">
  import type { Song, Tanda } from '$lib/types';
  import { player } from '$lib/stores/player.svelte';
  import { authState } from '$lib/stores/auth.svelte';
  import { replaceSongVideo, createFlag } from '$lib/firebase/db';
  import { searchYouTube, extractVideoId, getVideoById, type YTResult } from '$lib/utils/youtube';

  let { song, tanda, isOwner = false }: { song?: Song; tanda?: Tanda; isOwner?: boolean } = $props();

  const searchQuery = $derived(
    song && tanda
      ? encodeURIComponent(`${song.title} ${tanda.orchestra} tango`)
      : ''
  );

  // ── Wrong video / replace state ──
  let showReplace = $state(false);
  let replaceMode = $state<'search' | 'url'>('search');
  let replaceQuery = $state('');
  let replaceUrlInput = $state('');
  let replaceResults = $state<YTResult[]>([]);
  let replaceLoading = $state(false);
  let replaceError = $state('');
  let replaceSaving = $state(false);
  let debounceTimer: ReturnType<typeof setTimeout>;

  // ── Flag state (non-owners) ──
  let showFlagForm = $state(false);
  let flagReason = $state('');
  let flagSending = $state(false);
  let flagSent = $state(false);

  function openReplace() {
    showReplace = true;
    showFlagForm = false;
    replaceQuery = song && tanda ? `${song.title} ${tanda.orchestra} tango` : '';
    replaceResults = [];
    replaceError = '';
    replaceUrlInput = '';
  }

  function closeReplace() {
    showReplace = false;
    replaceResults = [];
    replaceError = '';
  }

  function handleReplaceInput() {
    clearTimeout(debounceTimer);
    replaceError = '';
    if (replaceQuery.length < 3) { replaceResults = []; return; }
    debounceTimer = setTimeout(async () => {
      replaceLoading = true;
      try {
        replaceResults = await searchYouTube(replaceQuery);
        if (replaceResults.length === 0) replaceError = 'No results found.';
      } catch (e: any) {
        replaceResults = [];
        replaceError = e.message || 'Search failed.';
      } finally {
        replaceLoading = false;
      }
    }, 300);
  }

  async function handleReplaceUrl() {
    replaceError = '';
    const videoId = extractVideoId(replaceUrlInput);
    if (!videoId) { replaceError = 'Could not extract video ID.'; return; }
    replaceLoading = true;
    try {
      const r = await getVideoById(videoId);
      if (r) await selectReplacement(r);
      else replaceError = 'Video not found.';
    } catch { replaceError = 'Failed to look up video.'; }
    finally { replaceLoading = false; }
  }

  async function selectReplacement(r: YTResult) {
    if (!player.set?.id || player.set.id === 'demo') {
      // Just update in-memory for demo
      player.replaceSongVideo(player.currentTandaIndex, player.currentSongIndex, {
        video_id: r.video_id,
        video_title: r.title,
        thumbnail: r.thumbnail || `https://img.youtube.com/vi/${r.video_id}/mqdefault.jpg`,
      });
      closeReplace();
      return;
    }
    replaceSaving = true;
    try {
      const videoData = {
        video_id: r.video_id,
        video_title: r.title,
        thumbnail: r.thumbnail || `https://img.youtube.com/vi/${r.video_id}/mqdefault.jpg`,
      };
      await replaceSongVideo(player.set.id, player.currentTandaIndex, player.currentSongIndex, videoData);
      player.replaceSongVideo(player.currentTandaIndex, player.currentSongIndex, videoData);
      closeReplace();
    } catch (e: any) {
      replaceError = 'Failed to save: ' + (e.message || 'Unknown error');
    } finally {
      replaceSaving = false;
    }
  }

  // ── Flag handling (non-owners) ──
  function openFlag() {
    showFlagForm = true;
    showReplace = false;
    flagReason = '';
    flagSent = false;
  }

  async function submitFlag() {
    if (!authState.user || !player.set?.id || !song) return;
    flagSending = true;
    try {
      await createFlag({
        setId: player.set.id,
        setTitle: player.set.title,
        ownerId: player.set.authorId,
        tandaIndex: player.currentTandaIndex,
        songIndex: player.currentSongIndex,
        songTitle: song.title,
        currentVideoId: song.video_id,
        reason: flagReason || 'Wrong video',
        flaggedBy: authState.user.uid,
        flaggedByName: authState.user.displayName || 'Anonymous',
        resolved: false,
      });
      flagSent = true;
    } catch (e) {
      console.error('Flag failed:', e);
    } finally {
      flagSending = false;
    }
  }
</script>

<div class="video-panel">
  <div class="video-wrapper">
    {#if song?.video_id}
      <iframe
        src="https://www.youtube.com/embed/{song.video_id}?rel=0"
        allow="encrypted-media"
        allowfullscreen
        title={song.title}
      ></iframe>
    {:else if song}
      <div class="no-video">
        <p>No video available</p>
        <a href="https://www.youtube.com/results?search_query={searchQuery}" target="_blank" rel="noopener">
          Search YouTube &#8599;
        </a>
      </div>
    {:else}
      <div class="video-placeholder">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
        <span>Select a song to play</span>
      </div>
    {/if}
  </div>

  {#if song && tanda}
    <div class="now-playing">
      <div class="np-title">{song.title}</div>
      <div class="np-meta">
        {tanda.orchestra}{song.singer ? ` \u00b7 ${song.singer}` : ''}{song.year ? ` \u00b7 ${song.year}` : ''} &middot; {tanda.genre}
      </div>

      <!-- Action buttons -->
      <div class="video-actions">
        {#if isOwner}
          <button class="action-btn" onclick={openReplace}>
            {showReplace ? 'Cancel' : 'Wrong video?'}
          </button>
        {:else if authState.isLoggedIn && player.set?.id && player.set.id !== 'demo'}
          <button class="action-btn flag-btn" onclick={openFlag}>
            {showFlagForm ? 'Cancel' : 'Flag wrong video'}
          </button>
        {/if}
      </div>
    </div>

    <!-- Owner: inline replacement search -->
    {#if showReplace && isOwner}
      <div class="replace-panel">
        <div class="replace-tabs">
          <button class="rtab" class:active={replaceMode === 'search'} onclick={() => replaceMode = 'search'}>Search</button>
          <button class="rtab" class:active={replaceMode === 'url'} onclick={() => replaceMode = 'url'}>Paste URL</button>
        </div>

        {#if replaceMode === 'search'}
          <input
            type="text"
            class="replace-input"
            placeholder="Search YouTube..."
            bind:value={replaceQuery}
            oninput={handleReplaceInput}
          />
          {#if replaceLoading}
            <div class="replace-status">Searching...</div>
          {:else if replaceError}
            <div class="replace-status error">{replaceError}</div>
          {/if}
          {#if replaceResults.length > 0}
            <div class="replace-results">
              {#each replaceResults as r}
                <button class="rr-card" onclick={() => selectReplacement(r)} disabled={replaceSaving}>
                  <img src={r.thumbnail || `https://img.youtube.com/vi/${r.video_id}/mqdefault.jpg`} alt="" class="rr-thumb" />
                  <div class="rr-info">
                    <div class="rr-title">{@html r.title}</div>
                    <div class="rr-channel">{r.channel}</div>
                  </div>
                  <span class="rr-use">Use</span>
                </button>
              {/each}
            </div>
          {/if}
        {:else}
          <div class="replace-url-row">
            <input
              type="text"
              class="replace-input"
              placeholder="Paste YouTube URL or video ID..."
              bind:value={replaceUrlInput}
              onkeydown={(e: KeyboardEvent) => e.key === 'Enter' && handleReplaceUrl()}
            />
            <button class="replace-url-btn" onclick={handleReplaceUrl} disabled={replaceLoading || !replaceUrlInput.trim()}>
              {replaceLoading ? '...' : 'Use'}
            </button>
          </div>
          {#if replaceError}
            <div class="replace-status error">{replaceError}</div>
          {/if}
        {/if}
        {#if replaceSaving}
          <div class="replace-status">Saving...</div>
        {/if}
      </div>
    {/if}

    <!-- Non-owner: flag form -->
    {#if showFlagForm && !isOwner}
      <div class="flag-panel">
        {#if flagSent}
          <div class="flag-thanks">Thanks! The owner will be notified.</div>
        {:else}
          <p class="flag-label">What's wrong with this video?</p>
          <input
            type="text"
            class="replace-input"
            placeholder="e.g. Wrong year, different song, bad audio..."
            bind:value={flagReason}
            onkeydown={(e: KeyboardEvent) => e.key === 'Enter' && submitFlag()}
          />
          <button class="flag-submit" onclick={submitFlag} disabled={flagSending}>
            {flagSending ? 'Sending...' : 'Submit flag'}
          </button>
        {/if}
      </div>
    {/if}
  {/if}
</div>

<style>
  .video-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    gap: 1.2rem;
    min-width: 0;
  }
  .video-wrapper {
    width: 100%;
    max-width: 700px;
    aspect-ratio: 16/9;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
  }
  .video-wrapper iframe {
    width: 100%;
    height: 100%;
    border: none;
  }
  .video-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-dim);
    font-size: 0.82rem;
    gap: 0.5rem;
  }
  .video-placeholder svg { opacity: 0.2; }
  .no-video {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-dim);
    font-size: 0.82rem;
    text-align: center;
    gap: 0.8rem;
  }
  .no-video a {
    color: var(--accent);
    text-decoration: none;
    font-weight: 500;
    padding: 0.35rem 0.9rem;
    border: 1px solid var(--accent);
    border-radius: 99px;
    font-size: 0.72rem;
    transition: all 0.15s;
  }
  .no-video a:hover { background: var(--accent); color: var(--bg); }
  .now-playing { text-align: center; max-width: 500px; }
  .now-playing .np-title {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 1.05rem;
    font-weight: 600;
    color: var(--text);
  }
  .now-playing .np-meta {
    font-size: 0.72rem;
    color: var(--text-dim);
    margin-top: 0.2rem;
  }

  /* Action buttons */
  .video-actions {
    margin-top: 0.5rem;
    display: flex;
    justify-content: center;
    gap: 0.5rem;
  }
  .action-btn {
    background: none;
    border: 1px solid var(--border);
    color: var(--text-dim);
    padding: 0.25rem 0.7rem;
    font-size: 0.65rem;
    font-weight: 500;
    border-radius: 99px;
    cursor: pointer;
    transition: all 0.15s;
    font-family: 'Outfit', sans-serif;
  }
  .action-btn:hover { border-color: var(--accent); color: var(--accent); }
  .action-btn.flag-btn:hover { border-color: var(--tango); color: var(--tango); }

  /* Replace panel (owner) */
  .replace-panel {
    width: 100%;
    max-width: 500px;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .replace-tabs {
    display: flex;
    gap: 0.25rem;
  }
  .rtab {
    background: var(--surface2);
    border: 1px solid var(--border);
    color: var(--text-dim);
    padding: 0.25rem 0.6rem;
    font-size: 0.65rem;
    font-weight: 500;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all 0.12s;
    font-family: 'Outfit', sans-serif;
  }
  .rtab:hover { border-color: var(--accent); color: var(--accent); }
  .rtab.active { background: var(--accent-dim); border-color: var(--accent); color: var(--accent); }
  .replace-input {
    width: 100%;
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--text);
    border-radius: var(--radius-sm);
    padding: 0.4rem 0.6rem;
    font-size: 0.78rem;
    font-family: 'Outfit', sans-serif;
  }
  .replace-input:focus { border-color: var(--accent); outline: none; }
  .replace-status {
    font-size: 0.68rem;
    color: var(--text-dim);
    padding: 0.2rem 0;
  }
  .replace-status.error { color: var(--tango); }
  .replace-results {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    max-height: 220px;
    overflow-y: auto;
  }
  .rr-card {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.35rem;
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
  .rr-card:hover { border-color: var(--accent); background: var(--accent-dim); }
  .rr-card:disabled { opacity: 0.5; cursor: default; }
  .rr-thumb {
    width: 54px;
    height: 30px;
    object-fit: cover;
    border-radius: 3px;
    flex-shrink: 0;
  }
  .rr-info { flex: 1; min-width: 0; }
  .rr-title {
    font-size: 0.7rem;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .rr-channel { font-size: 0.58rem; color: var(--text-dim); }
  .rr-use {
    font-size: 0.68rem;
    color: var(--accent);
    font-weight: 600;
    flex-shrink: 0;
    padding: 0 0.3rem;
  }
  .replace-url-row {
    display: flex;
    gap: 0.3rem;
  }
  .replace-url-row .replace-input { flex: 1; }
  .replace-url-btn {
    background: var(--accent);
    color: var(--bg);
    border: none;
    padding: 0.4rem 0.7rem;
    font-size: 0.72rem;
    font-weight: 600;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all 0.12s;
    font-family: 'Outfit', sans-serif;
    white-space: nowrap;
  }
  .replace-url-btn:hover:not(:disabled) { background: var(--accent-bright); }
  .replace-url-btn:disabled { opacity: 0.5; cursor: default; }

  /* Flag panel (non-owner) */
  .flag-panel {
    width: 100%;
    max-width: 400px;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    align-items: center;
  }
  .flag-label {
    font-size: 0.72rem;
    color: var(--text-dim);
  }
  .flag-submit {
    background: var(--tango);
    color: var(--bg);
    border: none;
    padding: 0.35rem 1rem;
    font-size: 0.72rem;
    font-weight: 600;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all 0.12s;
    font-family: 'Outfit', sans-serif;
  }
  .flag-submit:hover:not(:disabled) { opacity: 0.85; }
  .flag-submit:disabled { opacity: 0.5; cursor: default; }
  .flag-thanks {
    font-size: 0.75rem;
    color: var(--vals);
    padding: 0.5rem;
  }

  @media (max-width: 900px) {
    .video-panel { padding: 1.25rem; }
  }
  @media (max-width: 700px) {
    .video-panel { padding: 0.8rem; gap: 0.8rem; }
    .video-wrapper { border-radius: var(--radius-sm); }
    .replace-panel, .flag-panel { max-width: 100%; }
  }
</style>
