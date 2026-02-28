<script lang="ts">
  import { page } from '$app/state';
  import { replaceState } from '$app/navigation';
  import { player } from '$lib/stores/player.svelte';
  import { authState } from '$lib/stores/auth.svelte';
  import { getSet, getCommentsForSet } from '$lib/firebase/db';
  import type { PracticaSet, Comment, Tanda } from '$lib/types';
  import TandaComments from '$lib/components/player/TandaComments.svelte';
  import SongList from '$lib/components/player/SongList.svelte';
  import VideoPlayer from '$lib/components/player/VideoPlayer.svelte';
  import MobilePlayerView from '$lib/components/player/MobilePlayerView.svelte';

  import seedData from '$lib/data/seed.json';

  let isOwner = $derived(
    !!authState.user && !!player.set && player.set.authorId === authState.user.uid
  );

  let loading = $state(true);
  let error = $state('');
  let comments = $state<Comment[]>([]);

  const setId = $derived(page.params.id);

  $effect(() => {
    loadSet(setId);
  });

  async function loadSet(id: string) {
    loading = true;
    error = '';
    try {
      if (id === 'demo') {
        const demoSet: PracticaSet = {
          id: 'demo',
          title: seedData.meta.title,
          description: seedData.meta.description,
          authorId: 'demo',
          authorName: 'Demo',
          visibility: 'public',
          genre_summary: [...new Set(seedData.tandas.map(t => t.genre))] as PracticaSet['genre_summary'],
          tanda_count: seedData.tandas.length,
          song_count: seedData.tandas.reduce((sum, t) => sum + t.songs.length, 0),
          created_at: new Date(seedData.meta.created_at),
          updated_at: new Date(seedData.meta.updated_at),
          tandas: seedData.tandas.map(t => ({
            ...t,
            songs: t.songs.map(s => ({
              ...s,
              video_title: s.title,
              thumbnail: `https://img.youtube.com/vi/${s.video_id}/mqdefault.jpg`,
            })),
          })),
        };
        player.loadSet(demoSet);
        applyTandaParam();
      } else {
        const set = await getSet(id);
        if (!set) {
          error = 'Set not found';
          return;
        }
        player.loadSet(set);
        applyTandaParam();
        loadComments(id);
      }
    } catch (e) {
      error = 'Failed to load set';
      console.error(e);
    } finally {
      loading = false;
    }
  }

  function applyTandaParam() {
    const t = page.url.searchParams.get('tanda');
    if (t !== null) {
      const idx = parseInt(t, 10);
      if (!isNaN(idx) && idx >= 0 && idx < player.tandas.length) {
        player.selectTanda(idx);
      }
    }
  }

  // Keep URL in sync with current tanda
  $effect(() => {
    const idx = player.currentTandaIndex;
    if (!player.set) return;
    const url = new URL(window.location.href);
    url.searchParams.set('tanda', String(idx));
    replaceState(url, {});
  });

  function getTandaShareUrl(): string {
    const url = new URL(window.location.href);
    url.searchParams.set('tanda', String(player.currentTandaIndex));
    return url.toString();
  }

  // ── Share popup ──
  let shareOpen = $state(false);
  let linkCopied = $state(false);

  function copyShareLink() {
    navigator.clipboard.writeText(getTandaShareUrl());
    linkCopied = true;
    setTimeout(() => { linkCopied = false; }, 2000);
  }

  function shareToFacebook() {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(getTandaShareUrl())}`, '_blank', 'width=600,height=400');
    shareOpen = false;
  }

  function shareToTwitter() {
    const text = player.set ? `Check out "${player.set.title}" on Tandabase` : 'Check out this tanda set';
    window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(getTandaShareUrl())}&text=${encodeURIComponent(text)}`, '_blank', 'width=600,height=400');
    shareOpen = false;
  }

  function shareToWhatsApp() {
    const text = player.set ? `Check out "${player.set.title}" on Tandabase: ${getTandaShareUrl()}` : getTandaShareUrl();
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    shareOpen = false;
  }

  function getYearRange(tanda: Tanda): string {
    const years = tanda.songs.map(s => s.year).filter((y): y is number => y !== null).sort();
    if (!years.length) return '';
    return years[0] === years[years.length - 1] ? String(years[0]) : `${years[0]}\u2013${years[years.length - 1]}`;
  }

  async function loadComments(id: string) {
    try {
      comments = await getCommentsForSet(id);
    } catch (e) {
      console.error('Failed to load comments:', e);
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowRight') player.next();
    if (e.key === 'ArrowLeft') player.prev();
  }

  let touchX = 0;
  function handleTouchStart(e: TouchEvent) {
    touchX = e.changedTouches[0].screenX;
  }
  function handleTouchEnd(e: TouchEvent) {
    const d = e.changedTouches[0].screenX - touchX;
    if (Math.abs(d) > 80) {
      if (d > 0) player.prev();
      else player.next();
    }
  }
</script>

<svelte:head>
  <title>{player.set?.title ?? 'Practica Set'}</title>
</svelte:head>

<svelte:window onkeydown={handleKeydown} />
<svelte:body ontouchstart={handleTouchStart} ontouchend={handleTouchEnd} />

{#if loading}
  <div class="center-msg">Loading set...</div>
{:else if error}
  <div class="center-msg error">{error}</div>
{:else if player.set}
  <!-- Mobile: dedicated mobile player view -->
  <div class="mobile-only">
    <MobilePlayerView {comments} {isOwner} setId={player.set.id} oncommentadded={() => loadComments(player.set?.id ?? '')} />
  </div>

  <!-- Desktop: 2-panel layout -->
  <div class="desktop-only">
    <div class="layout">
      <!-- Left: set info + tanda list with inline song expand -->
      <aside class="panel-left">
        <div class="set-header">
          <div class="set-header-top">
            <h1 class="set-title">{player.set.title}</h1>
            <div class="share-wrap">
              <button class="share-btn" onclick={() => shareOpen = !shareOpen}>Share</button>
              {#if shareOpen}
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div class="share-backdrop" onclick={() => shareOpen = false}></div>
                <div class="share-popup">
                  <button class="share-option" onclick={copyShareLink}>
                    <span>{linkCopied ? '✓ Copied!' : '🔗 Copy link'}</span>
                  </button>
                  <button class="share-option" onclick={shareToWhatsApp}>
                    <span>💬 WhatsApp</span>
                  </button>
                  <button class="share-option" onclick={shareToFacebook}>
                    <span>📘 Facebook</span>
                  </button>
                  <button class="share-option" onclick={shareToTwitter}>
                    <span>🐦 X / Twitter</span>
                  </button>
                </div>
              {/if}
            </div>
          </div>
          <span class="meta-text">{player.tandas.length} tandas &middot; {player.set.song_count} songs</span>
        </div>

        <div class="tanda-list">
          {#each player.tandas as tanda, i}
            {@const yr = getYearRange(tanda)}
            {@const isActive = i === player.currentTandaIndex}
            <div class="tanda-item" class:active={isActive}>
              <button class="tanda-row" onclick={() => player.selectTanda(i)}>
                <span class="tanda-num">{String(tanda.num).padStart(2, '0')}</span>
                <span class="tanda-orch">{tanda.orchestra}</span>
                <span class="genre-tag {tanda.genre}">{tanda.genre}</span>
                {#if yr}<span class="tanda-years">{yr}</span>{/if}
                <span class="tanda-chevron" class:open={isActive}>&#9662;</span>
              </button>

              {#if isActive}
                <div class="song-expand">
                  {#each tanda.songs as song, si}
                    <button
                      class="song-row"
                      class:playing={si === player.currentSongIndex}
                      onclick={() => player.selectSong(si)}
                    >
                      <span class="song-idx">{si + 1}</span>
                      <span class="song-name">{song.title}</span>
                      {#if song.singer}
                        <span class="song-singer">{song.singer}</span>
                      {/if}
                    </button>
                  {/each}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      </aside>

      <!-- Right: video player + comments (always visible) -->
      <main class="panel-right">
        <VideoPlayer song={player.currentSong} tanda={player.currentTanda} {isOwner} />
        {#if player.currentTanda && player.set?.id}
          <div class="comments-bar">
            <TandaComments
              {comments}
              setId={player.set.id}
              tandaIndex={player.currentTandaIndex}
              oncommentadded={() => loadComments(player.set?.id ?? '')}
            />
          </div>
        {/if}
      </main>
    </div>
  </div>
{/if}

<style>
  .center-msg {
    display: flex;
    align-items: center;
    justify-content: center;
    height: calc(100vh - 56px);
    font-size: var(--fs-sm);
    color: var(--text-dim);
  }
  .center-msg.error { color: var(--tango); }

  /* ── 2-Panel Desktop Layout ── */
  .layout {
    display: flex;
    height: calc(100vh - 56px);
    height: calc(100dvh - 56px);
  }

  /* Left panel: set info + tanda list */
  .panel-left {
    width: 380px;
    min-width: 320px;
    background: var(--surface);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .set-header {
    padding: 1rem 1rem 0.7rem;
    border-bottom: 1px solid var(--border);
  }
  .set-header-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.5rem;
    margin-bottom: 0.3rem;
  }
  .set-title {
    font-family: 'Space Grotesk', sans-serif;
    font-size: var(--fs-lead);
    font-weight: 600;
    color: var(--text);
    line-height: 1.15;
    margin: 0;
  }
  .meta-text {
    font-size: var(--fs-xs);
    color: var(--text-dim);
  }

  /* Share popup */
  .share-btn {
    background: var(--surface2);
    border: 1px solid var(--border);
    color: var(--text-mid);
    padding: 0.25rem 0.6rem;
    font-size: var(--fs-xs);
    font-weight: 500;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all 0.15s;
    font-family: 'Outfit', sans-serif;
    flex-shrink: 0;
  }
  .share-btn:hover { border-color: var(--accent); color: var(--accent); }
  .share-wrap { position: relative; }
  .share-backdrop { position: fixed; inset: 0; z-index: 50; }
  .share-popup {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: 0 8px 24px rgba(0,0,0,0.4);
    min-width: 180px;
    z-index: 51;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .share-option {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.6rem 0.8rem;
    background: none;
    border: none;
    color: var(--text);
    font-size: var(--fs-xs);
    font-family: 'Outfit', sans-serif;
    cursor: pointer;
    transition: background 0.12s;
    text-align: left;
    white-space: nowrap;
  }
  .share-option:hover { background: var(--surface2); }

  /* Tanda list */
  .tanda-list {
    flex: 1;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--border) transparent;
  }
  .tanda-list::-webkit-scrollbar { width: 3px; }
  .tanda-list::-webkit-scrollbar-track { background: transparent; }
  .tanda-list::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }

  .tanda-item {
    border-bottom: 1px solid var(--border);
  }
  .tanda-item.active {
    background: var(--accent-dim);
  }

  .tanda-row {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.6rem 1rem;
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--text);
    font-family: 'Outfit', sans-serif;
    font-size: var(--fs-sm);
    text-align: left;
    transition: background 0.12s;
  }
  .tanda-row:hover { background: var(--surface2); }
  .tanda-item.active .tanda-row:hover { background: rgba(255,255,255,0.04); }

  .tanda-num {
    font-family: 'JetBrains Mono', monospace;
    font-size: var(--fs-xs);
    color: var(--text-dim);
    min-width: 20px;
    font-weight: 500;
  }
  .tanda-item.active .tanda-num { color: var(--accent); }

  .tanda-orch {
    font-weight: 500;
    flex: 1;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .tanda-item.active .tanda-orch { color: var(--accent-bright); font-weight: 600; }

  .genre-tag {
    font-size: var(--fs-2xs);
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    padding: 0.1rem 0.35rem;
    border-radius: 3px;
    flex-shrink: 0;
  }
  .genre-tag.Tango   { background: rgba(248,113,113,0.1); color: var(--tango); }
  .genre-tag.Milonga { background: rgba(96,165,250,0.1); color: var(--milonga); }
  .genre-tag.Vals    { background: rgba(74,222,128,0.1); color: var(--vals); }

  .tanda-years {
    font-family: 'JetBrains Mono', monospace;
    font-size: var(--fs-2xs);
    color: var(--text-dim);
    flex-shrink: 0;
  }
  .tanda-chevron {
    font-size: var(--fs-2xs);
    color: var(--text-dim);
    transition: transform 0.2s;
    flex-shrink: 0;
  }
  .tanda-chevron.open { transform: rotate(180deg); }

  /* Inline song expansion */
  .song-expand {
    padding: 0 0 0.3rem;
  }
  .song-row {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.3rem 1rem 0.3rem 2.6rem;
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--text-mid);
    font-family: 'Outfit', sans-serif;
    font-size: var(--fs-xs);
    text-align: left;
    transition: all 0.1s;
  }
  .song-row:hover { background: rgba(255,255,255,0.04); color: var(--text); }
  .song-row.playing {
    color: var(--accent-bright);
    font-weight: 600;
  }
  .song-idx {
    font-family: 'JetBrains Mono', monospace;
    font-size: var(--fs-2xs);
    color: var(--text-dim);
    min-width: 14px;
  }
  .song-row.playing .song-idx { color: var(--accent); }
  .song-name {
    flex: 1;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .song-singer {
    font-size: var(--fs-2xs);
    color: var(--text-dim);
    font-style: italic;
    flex-shrink: 0;
    max-width: 120px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Right panel: video + comments */
  .panel-right {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow-y: auto;
  }
  .comments-bar {
    flex-shrink: 0;
    border-top: 1px solid var(--border);
    padding: 0.4rem 1.2rem;
    background: var(--surface);
  }

  .mobile-only { display: none; }
  .desktop-only { display: block; }

  @media (max-width: 700px) {
    .desktop-only { display: none; }
    .mobile-only { display: block; }
  }
</style>
