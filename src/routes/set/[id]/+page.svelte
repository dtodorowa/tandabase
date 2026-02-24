<script lang="ts">
  import { page } from '$app/state';
  import { player } from '$lib/stores/player.svelte';
  import { authState } from '$lib/stores/auth.svelte';
  import { getSet, getCommentsForSet } from '$lib/firebase/db';
  import type { PracticaSet, Comment } from '$lib/types';
  import TandaComments from '$lib/components/player/TandaComments.svelte';
  import Sidebar from '$lib/components/player/Sidebar.svelte';
  import TandaHeader from '$lib/components/player/TandaHeader.svelte';
  import SongList from '$lib/components/player/SongList.svelte';
  import VideoPlayer from '$lib/components/player/VideoPlayer.svelte';
  import MobileDrawer from '$lib/components/player/MobileDrawer.svelte';

  import seedData from '$lib/data/seed.json';

  let isOwner = $derived(
    !!authState.user && !!player.set && player.set.authorId === authState.user.uid
  );

  let loading = $state(true);
  let error = $state('');
  let drawerOpen = $state(false);
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
      } else {
        const set = await getSet(id);
        if (!set) {
          error = 'Set not found';
          return;
        }
        player.loadSet(set);
        loadComments(id);
      }
    } catch (e) {
      error = 'Failed to load set';
      console.error(e);
    } finally {
      loading = false;
    }
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
  <!-- Mobile drawer -->
  <div class="mobile-only">
    <MobileDrawer tandas={player.tandas} open={drawerOpen} onclose={() => drawerOpen = false} />
  </div>

  <div class="player-header">
    <button class="menu-toggle" onclick={() => drawerOpen = true} aria-label="Open tanda list">&#9776;</button>
    <div class="header-info">
      <span class="set-title">{player.set.title}</span>
    </div>
    <div class="header-stats">
      <span>{player.tandas.length} tandas</span>
      <span>{player.set.song_count} songs</span>
    </div>
    <button class="share-btn" onclick={() => navigator.clipboard.writeText(window.location.href)} aria-label="Share">
      Share
    </button>
  </div>

  <div class="layout">
    <nav class="sidebar desktop-only">
      <Sidebar tandas={player.tandas} />
    </nav>
    <div class="main">
      <TandaHeader />
      <div class="content-area">
        {#if player.currentTanda}
          <SongList songs={player.currentTanda.songs} />
        {/if}
        <VideoPlayer song={player.currentSong} tanda={player.currentTanda} {isOwner} />
      </div>
      {#if player.currentTanda && player.set?.id}
        <div class="comments-strip">
          <TandaComments
            {comments}
            setId={player.set.id}
            tandaIndex={player.currentTandaIndex}
            oncommentadded={() => loadComments(player.set?.id ?? '')}
          />
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .center-msg {
    display: flex;
    align-items: center;
    justify-content: center;
    height: calc(100vh - 56px);
    font-size: 0.9rem;
    color: var(--text-dim);
  }
  .center-msg.error { color: var(--tango); }

  .player-header {
    display: flex;
    align-items: center;
    padding: 0.6rem 1.5rem;
    border-bottom: 1px solid var(--border);
    background: var(--surface);
    gap: 0.8rem;
    height: 44px;
  }
  .menu-toggle {
    display: none;
    background: none;
    border: 1px solid var(--border);
    color: var(--text-mid);
    width: 32px;
    height: 32px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-size: 1rem;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
  }
  .menu-toggle:hover { border-color: var(--accent); color: var(--accent); }
  .header-info { flex: 1; min-width: 0; }
  .set-title {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 1.5rem;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .header-stats {
    display: flex;
    gap: 0.5rem;
    font-size: 0.8rem;
    color: var(--text-dim);
    font-weight: 500;
  }
  .header-stats span {
    white-space: nowrap;
    background: var(--surface2);
    padding: 0.2rem 0.5rem;
    border-radius: 99px;
    border: 1px solid var(--border);
  }
  .share-btn {
    background: var(--surface2);
    border: 1px solid var(--border);
    color: var(--text-mid);
    padding: 0.3rem 0.7rem;
    font-size: 0.9rem;
    font-weight: 500;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all 0.15s;
    font-family: 'Outfit', sans-serif;
  }
  .share-btn:hover { border-color: var(--accent); color: var(--accent); }

  .layout {
    display: flex;
    height: calc(100vh - 56px - 44px);
    height: calc(100dvh - 56px - 44px);
  }
  .sidebar {
    width: 280px;
    min-width: 280px;
    border-right: 1px solid var(--border);
    overflow-y: auto;
    background: var(--surface);
    scrollbar-width: thin;
    scrollbar-color: var(--border) transparent;
  }
  .sidebar::-webkit-scrollbar { width: 3px; }
  .sidebar::-webkit-scrollbar-track { background: transparent; }
  .sidebar::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
  .main {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    overflow-x: hidden;
    min-width: 0;
  }
  .content-area {
    flex: 1;
    display: flex;
    min-height: 0;
  }

  .comments-strip {
    flex-shrink: 0;
    border-top: 1px solid var(--border);
    padding: 0.4rem 1.2rem;
    background: var(--surface);
  }

  .mobile-only { display: none; }
  .desktop-only { display: block; }

  @media (max-width: 900px) {
    .content-area { flex-direction: column; }
  }
  @media (max-width: 700px) {
    .menu-toggle { display: flex; }
    .header-stats { display: none; }
    .desktop-only { display: none; }
    .mobile-only { display: block; }
    .layout { height: calc(100vh - 56px - 44px); height: calc(100dvh - 56px - 44px); }
  }
</style>
