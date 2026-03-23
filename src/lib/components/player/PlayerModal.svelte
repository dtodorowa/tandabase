<script lang="ts">
  import { player } from '$lib/stores/player.svelte';
  import { playerModal } from '$lib/stores/playerModal.svelte';
  import { authState } from '$lib/stores/auth.svelte';
  import { replaceSongVideo, createFlag } from '$lib/firebase/db';
  import { searchYouTube, extractVideoId, getVideoById, type YTResult } from '$lib/utils/youtube';
  import { Square, X, SkipBack, SkipForward, Play, Pause } from 'lucide-svelte';

  let animateIn = $state(false);
  let sidebarEl = $state<HTMLElement | null>(null);
  let isStopped = $state(false);
  let videoIframe = $state<HTMLIFrameElement | null>(null);

  $effect(() => {
    if (playerModal.open) {
      // Trigger animation after mount
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          animateIn = true;
        });
      });
    } else {
      animateIn = false;
    }
  });

  // Auto-scroll sidebar to the active song whenever tanda or song changes
  $effect(() => {
    const ti = player.currentTandaIndex;
    const si = player.currentSongIndex;
    if (sidebarEl && playerModal.open) {
      requestAnimationFrame(() => {
        const songEl = sidebarEl?.querySelector(`[data-song-key="${ti}-${si}"]`);
        if (songEl) {
          songEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      });
    }
  });

  // Reset stopped state when song changes
  $effect(() => {
    // Access currentSong to track changes
    player.currentSong;
    isStopped = false;
  });

  function stopVideo() {
    if (videoIframe?.contentWindow) {
      videoIframe.contentWindow.postMessage(JSON.stringify({
        event: 'command',
        func: 'pauseVideo',
        args: []
      }), '*');
      isStopped = true;
    }
  }

  function resumeVideo() {
    if (videoIframe?.contentWindow) {
      videoIframe.contentWindow.postMessage(JSON.stringify({
        event: 'command',
        func: 'playVideo',
        args: []
      }), '*');
      isStopped = false;
    }
  }

  function close() {
    animateIn = false;
    setTimeout(() => {
      playerModal.close();
    }, 700);
  }

  function getYearRange(tanda: typeof player.currentTanda): string {
    if (!tanda) return '';
    const years = tanda.songs.map(s => s.year).filter((y): y is number => y !== null).sort();
    if (!years.length) return '';
    return years[0] === years[years.length - 1] ? String(years[0]) : `${years[0]}\u2013${years[years.length - 1]}`;
  }

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

  let showFlagForm = $state(false);
  let flagReason = $state('');
  let flagSending = $state(false);
  let flagSent = $state(false);

  let isOwner = $derived(
    !!authState.user && !!player.set && player.set.authorId === authState.user.uid
  );

  function openReplace() {
    showReplace = true;
    showFlagForm = false;
    replaceQuery = player.currentSong && player.currentTanda
      ? `${player.currentSong.title} ${player.currentTanda.orchestra} tango`
      : '';
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

  function openFlag() {
    showFlagForm = true;
    showReplace = false;
    flagReason = '';
    flagSent = false;
  }

  async function submitFlag() {
    if (!authState.user || !player.set?.id || !player.currentSong) return;
    flagSending = true;
    try {
      await createFlag({
        setId: player.set.id,
        setTitle: player.set.title,
        ownerId: player.set.authorId,
        tandaIndex: player.currentTandaIndex,
        songIndex: player.currentSongIndex,
        songTitle: player.currentSong.title,
        currentVideoId: player.currentSong.video_id,
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

{#if playerModal.open}
  <!-- Overlay -->
  <div class="fixed inset-0 z-50 flex flex-col justify-end">

    <!-- Backdrop -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      class="absolute inset-0 bg-black/20 transition-opacity duration-500 {animateIn ? 'opacity-100' : 'opacity-0'}"
      onclick={close}
      role="presentation"
    ></div>

    <!-- Panel -->
    <div class="glass w-full md:h-[85vh] rounded-t-[2.5rem] shadow-2xl relative transition-transform duration-700 ease-spring flex flex-col overflow-hidden border-t border-white/40 dark:border-white/10 {animateIn ? 'translate-y-0' : 'translate-y-full'}">

      <!-- Close button -->
      <button
        onclick={close}
        class="absolute top-6 right-6 md:top-8 md:right-8 w-12 h-12 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 flex items-center justify-center transition-colors z-20 cursor-pointer border-none"
      >
        <X class="w-6 h-6 text-ink" />
      </button>

      <!-- Header -->
      <div class="px-6 md:px-16 pt-10 pb-6 border-b border-black/5 dark:border-white/5 shrink-0">
        <p class="text-ink-muted text-xs font-medium tracking-[0.2em] uppercase mb-2">
          Curated by {player.set?.authorName ?? 'Unknown'}
        </p>
        <h2 class="font-serif text-3xl md:text-5xl text-ink tracking-tight">
          {player.set?.title ?? 'Setlist'}
        </h2>
      </div>

      <!-- Content: Video + Sidebar -->
      <div class="grow flex flex-col md:flex-row overflow-y-auto md:overflow-hidden">

        <!-- Left: Video + Now Playing -->
        <div class="w-full md:w-1/2 px-4 py-3 md:p-12 flex flex-col md:justify-center items-center relative md:overflow-y-auto shrink-0 md:shrink">
          <!-- Video embed -->
          <div class="w-full max-w-lg aspect-video rounded-xl md:rounded-2xl overflow-hidden shadow-[0_20px_40px_rgba(0,0,0,0.15)] bg-ink relative group">
            {#if player.currentSong?.video_id}
              <iframe
                bind:this={videoIframe}
                class="w-full h-full opacity-80 group-hover:opacity-100 transition-opacity duration-500"
                src="https://www.youtube.com/embed/{player.currentSong.video_id}?rel=0&autoplay=1&enablejsapi=1&playsinline=1"
                title="YouTube player"
                frameborder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen
              ></iframe>
            {:else}
              <div class="w-full h-full flex items-center justify-center text-white/40">
                <Play class="w-12 h-12" />
              </div>
            {/if}
          </div>

          <!-- Now Playing info -->
          <div class="w-full mt-4 md:mt-10 text-center">
            <!-- <span class="text-[10px] font-medium px-3 py-1 rounded-full bg-ink/5 dark:bg-white/5 text-ink-muted mb-2 md:mb-4 inline-block tracking-[0.2em] uppercase">Now Playing</span> -->
            <h3 class="font-serif text-xl md:text-3xl text-ink mb-1 md:mb-2">
              {player.currentSong?.title ?? 'Select a track'}
            </h3>
            <p class="text-ink-muted font-light text-xs md:text-sm">
              {player.currentTanda?.orchestra ?? ''}
              {#if player.currentSong?.singer} · {player.currentSong.singer}{/if}
              {#if player.currentSong?.year} · {player.currentSong.year}{/if}
            </p>

            <!-- Prev / Stop / Next controls -->
            <div class="mt-4 md:mt-8 flex justify-center gap-4 items-center">
              <button
                onclick={() => player.prev()}
                disabled={player.isFirst}
                class="w-12 h-12 rounded-full border border-black/10 dark:border-white/10 flex items-center justify-center text-ink-muted hover:bg-ink hover:text-white dark:hover:bg-white dark:hover:text-ink transition-colors cursor-pointer bg-transparent disabled:opacity-30 disabled:cursor-default disabled:hover:bg-transparent disabled:hover:text-ink-muted"
              >
                <SkipBack class="w-5 h-5" />
              </button>

              {#if isStopped}
                <button
                  onclick={resumeVideo}
                  class="w-14 h-14 rounded-full border-2 border-black/15 dark:border-white/15 flex items-center justify-center text-ink hover:bg-ink hover:text-white dark:hover:bg-white dark:hover:text-ink transition-colors cursor-pointer bg-transparent"
                  title="Resume"
                >
                  <Play class="w-6 h-6" />
                </button>
              {:else}
                <button
                  onclick={stopVideo}
                  disabled={!player.currentSong?.video_id}
                  class="w-14 h-14 rounded-full border-2 border-black/15 dark:border-white/15 flex items-center justify-center text-ink hover:bg-ink hover:text-white dark:hover:bg-white dark:hover:text-ink transition-colors cursor-pointer bg-transparent disabled:opacity-30 disabled:cursor-default"
                  title="Stop"
                >
                  <Square class="w-5 h-5" />
                </button>
              {/if}

              <button
                onclick={() => player.next()}
                disabled={player.isLast}
                class="w-12 h-12 rounded-full border border-black/10 dark:border-white/10 flex items-center justify-center text-ink-muted hover:bg-ink hover:text-white dark:hover:bg-white dark:hover:text-ink transition-colors cursor-pointer bg-transparent disabled:opacity-30 disabled:cursor-default disabled:hover:bg-transparent disabled:hover:text-ink-muted"
              >
                <SkipForward class="w-5 h-5" />
              </button>
            </div>

            <!-- Wrong video / flag -->
            <div class="mt-3 md:mt-6">
              {#if isOwner}
                <button
                  class="text-xs text-ink-faint hover:text-ink transition-colors underline underline-offset-4 cursor-pointer bg-transparent border-none font-sans"
                  onclick={showReplace ? closeReplace : openReplace}
                >
                  {showReplace ? 'Cancel' : 'Wrong video?'}
                </button>
              {:else if authState.isLoggedIn && player.set?.id && player.set.id !== 'demo'}
                <button
                  class="text-xs text-ink-faint hover:text-tango transition-colors underline underline-offset-4 cursor-pointer bg-transparent border-none font-sans"
                  onclick={showFlagForm ? () => { showFlagForm = false; } : openFlag}
                >
                  {showFlagForm ? 'Cancel' : 'Report incorrect recording'}
                </button>
              {/if}
            </div>

            <!-- Replace panel (owner) -->
            {#if showReplace && isOwner}
              <div class="mt-4 w-full max-w-sm mx-auto flex flex-col gap-2 text-left">
                <div class="flex gap-1 justify-center">
                  <button class="px-3 py-1 text-xs rounded-full border cursor-pointer font-sans {replaceMode === 'search' ? 'bg-ink text-surface border-ink' : 'bg-transparent text-ink-muted border-black/10 dark:border-white/10 hover:text-ink'}" onclick={() => replaceMode = 'search'}>Search</button>
                  <button class="px-3 py-1 text-xs rounded-full border cursor-pointer font-sans {replaceMode === 'url' ? 'bg-ink text-surface border-ink' : 'bg-transparent text-ink-muted border-black/10 dark:border-white/10 hover:text-ink'}" onclick={() => replaceMode = 'url'}>Paste URL</button>
                </div>
                {#if replaceMode === 'search'}
                  <input
                    type="text"
                    class="w-full bg-surface dark:bg-background border border-black/10 dark:border-white/10 rounded-lg p-2.5 font-mono text-sm text-ink outline-none focus:border-ink transition-colors"
                    placeholder="Search YouTube..."
                    bind:value={replaceQuery}
                    oninput={handleReplaceInput}
                  />
                  {#if replaceLoading}<p class="text-xs text-ink-muted">Searching...</p>{/if}
                  {#if replaceError}<p class="text-xs text-tango">{replaceError}</p>{/if}
                  {#if replaceResults.length > 0}
                    <div class="max-h-40 overflow-y-auto flex flex-col gap-1">
                      {#each replaceResults as r}
                        <button class="flex items-center gap-2 p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer bg-transparent border-none text-left w-full font-sans" onclick={() => selectReplacement(r)} disabled={replaceSaving}>
                          <img src={r.thumbnail || `https://img.youtube.com/vi/${r.video_id}/mqdefault.jpg`} alt="" class="w-12 h-7 object-cover rounded shrink-0" />
                          <span class="text-xs text-ink truncate">{@html r.title}</span>
                        </button>
                      {/each}
                    </div>
                  {/if}
                {:else}
                  <div class="flex gap-2">
                    <input
                      type="text"
                      class="flex-1 bg-surface dark:bg-background border border-black/10 dark:border-white/10 rounded-lg p-2.5 font-mono text-sm text-ink outline-none focus:border-ink transition-colors"
                      placeholder="Paste YouTube URL..."
                      bind:value={replaceUrlInput}
                      onkeydown={(e: KeyboardEvent) => e.key === 'Enter' && handleReplaceUrl()}
                    />
                    <button class="px-4 py-2 bg-ink text-surface rounded-lg text-xs font-medium cursor-pointer border-none" onclick={handleReplaceUrl} disabled={replaceLoading || !replaceUrlInput.trim()}>
                      {replaceLoading ? '...' : 'Use'}
                    </button>
                  </div>
                  {#if replaceError}<p class="text-xs text-tango">{replaceError}</p>{/if}
                {/if}
                {#if replaceSaving}<p class="text-xs text-ink-muted">Saving...</p>{/if}
              </div>
            {/if}

            <!-- Flag panel (non-owner) -->
            {#if showFlagForm && !isOwner}
              <div class="mt-4 w-full max-w-sm mx-auto flex flex-col gap-2 items-center">
                {#if flagSent}
                  <p class="text-xs text-vals">Thanks! The owner will be notified.</p>
                {:else}
                  <p class="text-xs text-ink-muted">What's wrong with this video?</p>
                  <input
                    type="text"
                    class="w-full bg-surface dark:bg-background border border-black/10 dark:border-white/10 rounded-lg p-2.5 text-sm text-ink outline-none focus:border-ink transition-colors font-sans"
                    placeholder="e.g. Wrong year, different song..."
                    bind:value={flagReason}
                    onkeydown={(e: KeyboardEvent) => e.key === 'Enter' && submitFlag()}
                  />
                  <button class="px-6 py-2 bg-tango text-white rounded-lg text-xs font-medium cursor-pointer border-none" onclick={submitFlag} disabled={flagSending}>
                    {flagSending ? 'Sending...' : 'Submit flag'}
                  </button>
                {/if}
              </div>
            {/if}
          </div>
        </div>

        <!-- Right: Track sidebar -->
        <div bind:this={sidebarEl} class="w-full md:w-1/2 border-t md:border-t-0 md:border-l border-black/5 dark:border-white/5 overflow-y-auto no-scrollbar relative p-4 md:p-12 grow min-h-0">

          {#each player.tandas as tanda, ti (tanda.id)}
            {@const isActiveTanda = ti === player.currentTandaIndex}
            {@const yr = getYearRange(tanda)}

            <div class="mb-10" data-tanda-index={ti}>
              <div class="flex items-baseline gap-4 mb-6">
                <span class="text-xs font-medium tracking-widest uppercase {isActiveTanda ? 'text-ink' : 'text-ink-faint'}">
                  Tanda {String(tanda.num).padStart(2, '0')}
                </span>
                <h3 class="font-serif text-2xl {isActiveTanda ? 'text-ink' : 'text-ink-muted'}">
                  {tanda.orchestra}
                </h3>
                {#if yr}
                  <span class="text-xs text-ink-faint font-mono">{yr}</span>
                {/if}
              </div>

              <div class="space-y-2">
                {#each tanda.songs as song, si}
                  {@const isPlaying = isActiveTanda && si === player.currentSongIndex}
                  <button
                    data-song-key="{ti}-{si}"
                    onclick={() => { player.selectTanda(ti); player.selectSong(si); }}
                    class="group relative flex items-center justify-between p-4 rounded-xl w-full text-left cursor-pointer transition-all border font-sans bg-transparent
                      {isPlaying
                        ? 'bg-card dark:bg-card shadow-sm border-black/5 dark:border-white/5'
                        : 'hover:bg-black/5 dark:hover:bg-white/5 border-transparent'}"
                  >
                    <!-- Active indicator bar -->
                    <div class="absolute left-0 w-1 h-1/2 bg-ink rounded-r-full top-1/2 -translate-y-1/2 transition-opacity {isPlaying ? 'opacity-100' : 'opacity-0'}"></div>

                    <div class="flex items-center gap-4">
                      <div class="w-6 text-center text-xs font-medium {isPlaying ? 'text-ink' : 'text-ink-faint group-hover:text-ink'} transition-colors">
                        {String(si + 1).padStart(2, '0')}
                      </div>
                      <div>
                        <p class="font-medium text-sm transition-colors {isPlaying ? 'text-ink' : 'text-ink/70 group-hover:text-ink'}">
                          {song.title}
                        </p>
                        {#if song.singer || song.year}
                          <p class="text-xs mt-0.5 transition-colors {isPlaying ? 'text-ink-muted' : 'text-ink-muted/50 group-hover:text-ink-muted'}">
                            {song.singer ?? ''}{song.singer && song.year ? ' · ' : ''}{song.year ?? ''}
                          </p>
                        {/if}
                      </div>
                    </div>
                    {#if song.year}
                      <span class="text-xs text-ink-faint font-mono shrink-0">{song.year}</span>
                    {/if}
                  </button>
                {/each}
              </div>
            </div>

            {#if ti < player.tandas.length - 1}
              <hr class="border-black/5 dark:border-white/5 mb-10" />
            {/if}
          {/each}

          <div class="h-12"></div>
        </div>
      </div>
    </div>
  </div>
{/if}
