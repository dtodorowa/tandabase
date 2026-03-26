<script lang="ts">
  import { editor } from '$lib/stores/editor.svelte';
  import {
    ORCHESTRA_NAMES,
    loadDiscography,
    searchRecordings,
    getSingers,
    getGenres,
    getUniqueYears,
    type Recording
  } from '$lib/utils/discography';
  import { searchYouTube, extractVideoId, getVideoById, type YTResult } from '$lib/utils/youtube';
  import type { Song, Genre } from '$lib/types';
  import { X, Search, ArrowLeft, Music, Plus, Check, ChevronDown, Trash2, GripVertical } from 'lucide-svelte';

  let {
    slotIndex,
    onclose,
    ondelete,
  }: {
    slotIndex: number;
    onclose: () => void;
    ondelete?: () => void;
  } = $props();

  let showDeleteConfirm = $state(false);

  // Panel state machine
  type PanelStep = 'orchestra' | 'songs' | 'youtube';
  let step = $state<PanelStep>('orchestra');

  // Orchestra selection
  let orchestraQuery = $state('');
  let selectedOrchestra = $state('');

  // Genre selection
  const genres: Genre[] = ['Tango', 'Milonga', 'Vals'];
  let selectedGenre = $state<Genre>('Tango');

  // Discography state
  let recordings = $state<Recording[]>([]);
  let discographyLoading = $state(false);
  let songQuery = $state('');
  let singerFilter = $state('');
  let availableSingers = $state<string[]>([]);
  let availableGenres = $state<string[]>([]);
  let availableYears = $state<string[]>([]);
  let genreFilter = $state('');
  let yearFrom = $state('');
  let yearTo = $state('');
  let sortOrder = $state<'relevance' | 'date-asc' | 'date-desc'>('relevance');

  // Description
  let tandaDescription = $state('');

  // Selected songs for this tanda
  let selectedSongs = $state<Song[]>([]);

  // YouTube fallback
  let ytQuery = $state('');
  let ytResults = $state<YTResult[]>([]);
  let ytLoading = $state(false);
  let ytSearched = $state(false);
  let ytUrlInput = $state('');
  let ytUrlLoading = $state(false);
  let ytError = $state('');

  // Mobile tab state for 2-pane view
  type MobileTab = 'search' | 'selected';
  let mobileTab = $state<MobileTab>('search');

  // Recently added song ID for highlight animation
  let recentlyAddedId = $state<string | null>(null);
  let addAnimTimeout: ReturnType<typeof setTimeout>;

  // Duration map: songId -> duration string (populated when selecting from discography)
  const durationMap = new Map<string, string>();

  // Current tanda data
  const tanda = $derived(editor.tandas[slotIndex]);

  // Filtered orchestras
  const filteredOrchestras = $derived(
    orchestraQuery.trim()
      ? ORCHESTRA_NAMES.filter(o => o.toLowerCase().includes(orchestraQuery.toLowerCase()))
      : ORCHESTRA_NAMES
  );

  // Filtered recordings from discography
  const filteredRecordings = $derived.by(() => {
    let results = searchRecordings(recordings, songQuery, {
      genre: genreFilter || undefined,
      singer: singerFilter || undefined,
      yearFrom: yearFrom || undefined,
      yearTo: yearTo || undefined,
    }, 2000);

    if (sortOrder === 'date-asc') {
      results = [...results].sort((a, b) => (a.recording_date || '').localeCompare(b.recording_date || ''));
    } else if (sortOrder === 'date-desc') {
      results = [...results].sort((a, b) => (b.recording_date || '').localeCompare(a.recording_date || ''));
    }

    return results;
  });

  // Initialize from existing tanda data if editing (run once on mount)
  let initialized = false;
  $effect(() => {
    if (initialized) return;
    initialized = true;
    if (tanda && tanda.orchestra) {
      selectedOrchestra = tanda.orchestra;
      selectedGenre = tanda.genre;
      tandaDescription = tanda.description || '';
      selectedSongs = [...tanda.songs];
      if (ORCHESTRA_NAMES.some(o => o.toLowerCase() === selectedOrchestra.toLowerCase())) {
        const matchedKey = ORCHESTRA_NAMES.find(o => o.toLowerCase() === selectedOrchestra.toLowerCase()) || selectedOrchestra;
        loadOrchestra(matchedKey);
      } else {
        step = 'songs';
      }
    }
  });

  async function loadOrchestra(name: string, skipStepChange = false) {
    selectedOrchestra = name;
    discographyLoading = true;
    try {
      recordings = await loadDiscography(name);
      availableSingers = getSingers(recordings);
      availableGenres = getGenres(recordings);
      availableYears = getUniqueYears(recordings);
      if (!skipStepChange) step = 'songs';
      else step = 'songs';
    } catch (e) {
      console.error('Failed to load discography:', e);
      recordings = [];
      step = 'songs';
    } finally {
      discographyLoading = false;
    }
  }

  function selectRecording(rec: Recording) {
    const song: Song = {
      id: crypto.randomUUID(),
      title: rec.title,
      singer: rec.singer === 'Instrumental' || rec.singer === '-' ? null : rec.singer,
      year: rec.recording_date ? parseInt(rec.recording_date) || null : null,
      video_id: rec.youtube_id || '',
      video_title: rec.youtube_id ? rec.title : '',
      thumbnail: rec.youtube_id ? `https://img.youtube.com/vi/${rec.youtube_id}/mqdefault.jpg` : '',
    };
    if (rec.duration) durationMap.set(song.id, rec.duration);
    selectedSongs = [...selectedSongs, song];
    triggerAddHighlight(song.id);
  }

  function triggerAddHighlight(songId: string) {
    clearTimeout(addAnimTimeout);
    recentlyAddedId = songId;
    addAnimTimeout = setTimeout(() => { recentlyAddedId = null; }, 800);
  }

  function removeSong(songId: string) {
    selectedSongs = selectedSongs.filter(s => s.id !== songId);
  }

  function addYTResult(r: YTResult) {
    const song: Song = {
      id: crypto.randomUUID(),
      title: r.title.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'"),
      singer: null,
      year: null,
      video_id: r.video_id,
      video_title: r.title,
      thumbnail: r.thumbnail || `https://img.youtube.com/vi/${r.video_id}/mqdefault.jpg`,
    };
    selectedSongs = [...selectedSongs, song];
    triggerAddHighlight(song.id);
    step = 'songs';
  }

  let ytDebounce: ReturnType<typeof setTimeout>;
  function handleYTSearch() {
    clearTimeout(ytDebounce);
    ytError = '';
    if (ytQuery.length < 3) { ytResults = []; ytSearched = false; return; }
    ytDebounce = setTimeout(async () => {
      ytLoading = true;
      ytSearched = true;
      try {
        ytResults = await searchYouTube(ytQuery);
      } catch (e: any) {
        ytError = e.message || 'Search failed';
        ytResults = [];
      } finally {
        ytLoading = false;
      }
    }, 400);
  }

  async function handleYTUrl() {
    ytError = '';
    const videoId = extractVideoId(ytUrlInput);
    if (!videoId) { ytError = 'Could not extract video ID.'; return; }
    ytUrlLoading = true;
    try {
      const r = await getVideoById(videoId);
      if (r) { addYTResult(r); ytUrlInput = ''; }
      else { ytError = 'Video not found.'; }
    } catch { ytError = 'Failed to look up video.'; }
    finally { ytUrlLoading = false; }
  }

  function saveTanda() {
    if (!tanda) return;
    editor.updateTanda(tanda.id, {
      orchestra: selectedOrchestra,
      genre: selectedGenre,
      description: tandaDescription.trim() || '',
    });
    // Replace all songs
    const currentSongIds = tanda.songs.map(s => s.id);
    for (const id of currentSongIds) {
      editor.removeSongFromTanda(tanda.id, id);
    }
    for (const song of selectedSongs) {
      editor.addSongToTanda(tanda.id, song);
    }
    onclose();
  }

  function selectAllFiltered() {
    for (const rec of filteredRecordings) {
      if (!isAlreadySelected(rec)) {
        selectRecording(rec);
      }
    }
  }

  function clearAllSongs() {
    selectedSongs = [];
  }

  function isAlreadySelected(rec: Recording): boolean {
    return selectedSongs.some(s =>
      s.title === rec.title && (s.year === (parseInt(rec.recording_date) || null))
    );
  }

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function formatRecordingDate(dateStr: string | undefined | null): string {
    if (!dateStr) return '';
    const trimmed = dateStr.trim();
    const fullMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (fullMatch) {
      const [, y, m, d] = fullMatch;
      const day = parseInt(d);
      const month = MONTHS[parseInt(m) - 1] || m;
      return `${day} ${month} ${y}`;
    }
    const ymMatch = trimmed.match(/^(\d{4})-(\d{2})$/);
    if (ymMatch) {
      const [, y, m] = ymMatch;
      const month = MONTHS[parseInt(m) - 1] || m;
      return `${month} ${y}`;
    }
    return trimmed;
  }

  // Consistent color palette for singers
  const SINGER_COLORS = [
    'bg-violet-100 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400',
    'bg-sky-100 text-sky-700 dark:bg-sky-900/20 dark:text-sky-400',
    'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
    'bg-rose-100 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400',
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400',
    'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400',
    'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/20 dark:text-cyan-400',
    'bg-pink-100 text-pink-700 dark:bg-pink-900/20 dark:text-pink-400',
    'bg-lime-100 text-lime-700 dark:bg-lime-900/20 dark:text-lime-400',
    'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400',
  ];
  const INSTRUMENTAL_COLOR = 'bg-black/5 text-ink-muted dark:bg-white/5 dark:text-ink-faint';
  const singerColorMap: Record<string, string> = {};

  function getSingerColor(singer: string | null | undefined): string {
    if (!singer || singer === 'Instrumental' || singer === '-' || singer === '') return INSTRUMENTAL_COLOR;
    if (singerColorMap[singer]) return singerColorMap[singer];
    const idx = Object.keys(singerColorMap).length % SINGER_COLORS.length;
    singerColorMap[singer] = SINGER_COLORS[idx];
    return singerColorMap[singer];
  }
</script>

<style>
  @keyframes flash-highlight {
    0% { background-color: rgba(74, 222, 128, 0.25); }
    100% { background-color: transparent; }
  }
  .song-just-added {
    animation: flash-highlight 0.8s ease-out;
  }
</style>

<!-- Backdrop -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
  class="fixed inset-0 bg-black/30 dark:bg-black/50 z-40 transition-opacity duration-300 flex items-center justify-center p-4"
  onclick={(e: MouseEvent) => { if (e.target === e.currentTarget) onclose(); }}
>

<!-- Dialog — wider for 2-pane layout on songs step -->
<div class="relative w-full max-w-5xl max-h-[90vh] bg-white dark:bg-card z-50 shadow-2xl flex flex-col rounded-2xl border border-black/10 dark:border-white/5 overflow-hidden transition-all duration-300">

  <!-- Header -->
  <div class="px-6 py-4 border-b border-black/5 dark:border-white/5 flex justify-between items-center bg-surface/50 dark:bg-background/50 shrink-0">
    <div>
      <span class="font-mono text-[10px] text-ink-muted uppercase tracking-widest">Tanda {String((slotIndex + 1)).padStart(2, '0')}</span>
      <h3 class="font-serif text-2xl text-ink mt-0.5">
        {#if selectedOrchestra}
          {selectedOrchestra}
        {:else}
          {selectedGenre}
        {/if}
      </h3>
      
      <!-- Description input (top) -->
      <div class="ml-[-5px] pt-1 md:pt-3 w-[200px] sm:w-[400px] md:w-[600px] shrink-0">
        <input
          type="text"
          placeholder="Add a note for this tanda (optional)..."
          bind:value={tandaDescription}
          class="w-full bg-white dark:bg-card border border-black/5 dark:border-white/5 rounded-lg px-3 py-2 text-xs text-ink outline-none focus:border-ink dark:focus:border-white transition-colors font-sans placeholder:text-ink-faint"
        />
      </div>
    </div>
    <div class="flex self-start  items-center gap-1">
      {#if step !== 'orchestra'}
        <button
          onclick={() => step = 'orchestra'}
          class="h-9 px-3 rounded-full hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-1.5 transition-colors cursor-pointer bg-transparent border-none text-ink-muted hover:text-ink"
          title="Back to orchestras — add tandas from other orchestras"
        >
          <ArrowLeft class="w-4 h-4" />
        </button>
      {/if}

      <button
        onclick={onclose}
        class="w-9 h-9 rounded-full hover:bg-black/5 dark:hover:bg-white/5 flex items-center justify-center transition-colors cursor-pointer bg-transparent border-none"
      >
        <X class="w-5 h-5 text-ink" />
      </button>
    </div>
  </div>

  <!-- STEP: Orchestra Selection (unchanged layout) -->
  {#if step === 'orchestra'}
    <div class="flexflex-col grow overflow-hidden">
      <div class="p-6 overflow-y-auto grow">
        <!-- Orchestra search -->
        <div class="mb-4">
          <div class="relative">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
            <input
              type="text"
              placeholder="Search orchestras..."
              bind:value={orchestraQuery}
              class="w-full pl-10 pr-4 py-3 bg-surface dark:bg-background border border-black/5 dark:border-white/5 rounded-xl text-sm text-ink outline-none focus:border-ink dark:focus:border-white transition-colors font-sans"
            />
          </div>
        </div>

        <!-- Orchestra grid -->
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {#each filteredOrchestras as orch}
            <button
              onclick={() => loadOrchestra(orch)}
              class="p-3.5 border rounded-xl text-sm text-left cursor-pointer transition-all font-sans
                {selectedOrchestra === orch
                  ? 'border-ink bg-surface dark:bg-background font-medium text-ink'
                  : 'border-black/10 dark:border-white/10 hover:border-black/30 dark:hover:border-white/30 text-ink/70 hover:text-ink bg-transparent'}"
            >
              {orch}
            </button>
          {/each}
        </div>

        {#if filteredOrchestras.length === 0}
          <p class="text-sm text-ink-muted mt-4">No orchestras match "{orchestraQuery}"</p>
        {/if}

        <!-- Custom orchestra option -->
        {#if orchestraQuery.trim() && !ORCHESTRA_NAMES.some(o => o.toLowerCase() === orchestraQuery.toLowerCase())}
          <div class="mt-4 pt-4 border-t border-black/5 dark:border-white/5">
            <button
              onclick={() => { selectedOrchestra = orchestraQuery.trim(); recordings = []; step = 'songs'; }}
              class="w-full p-3.5 border border-dashed border-black/20 dark:border-white/20 rounded-xl text-sm text-ink-muted hover:text-ink hover:border-ink dark:hover:border-white text-left cursor-pointer transition-all font-sans bg-transparent"
            >
              Use custom: <strong class="text-ink">{orchestraQuery.trim()}</strong>
            </button>
          </div>
        {/if}
      </div>

      {#if discographyLoading}
        <div class="p-6 border-t border-black/5 dark:border-white/5 bg-surface/50 dark:bg-background/50 shrink-0">
          <p class="text-sm text-ink-muted text-center">Loading discography...</p>
        </div>
      {/if}
    </div>
  {/if}

  <!-- STEP: Song Selection — 2-pane layout (desktop) / tabbed (mobile) -->
  {#if step === 'songs'}
    <!-- Mobile tab switcher (visible only on small screens) -->
    <div class="flex md:hidden border-b border-black/5 dark:border-white/5 shrink-0">
      <button
        onclick={() => mobileTab = 'search'}
        class="flex-1 py-2.5 text-sm font-medium text-center transition-colors cursor-pointer bg-transparent border-none font-sans
          {mobileTab === 'search'
            ? 'text-ink border-b-2 border-ink dark:border-white'
            : 'text-ink-muted hover:text-ink'}"
      >
        Search
      </button>
      <button
        onclick={() => mobileTab = 'selected'}
        class="flex-1 py-2.5 text-sm font-medium text-center transition-colors cursor-pointer bg-transparent border-none font-sans
          {mobileTab === 'selected'
            ? 'text-ink border-b-2 border-ink dark:border-white'
            : 'text-ink-muted hover:text-ink'}"
      >
        Selected ({selectedSongs.length})
      </button>
    </div>

    <!-- 2-pane content area -->
    <div class="flex grow overflow-hidden min-h-0">

      <!-- ═══ LEFT PANE: Selected tracks ═══ -->
      <div class="
        {mobileTab === 'selected' ? 'flex' : 'hidden'} md:flex
        flex-col w-full md:w-[40%] border-r-0 md:border-r border-black/5 dark:border-white/5 bg-surface/30 dark:bg-background/30 overflow-hidden
      ">
 

        <!-- Header row with actions -->
        <div class="flex justify-between items-center px-4 py-2 shrink-0">
          <h4 class="text-xs font-medium text-ink uppercase tracking-widest">
            Selected <span class="text-ink-muted">({selectedSongs.length})</span>
          </h4>
          <div class="flex items-center gap-1.5">
            <button
              onclick={selectAllFiltered}
              class="text-[10px] font-medium px-2 py-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer bg-transparent border-none font-sans text-ink-muted hover:text-ink"
              title="Add all currently filtered results"
            >
              + All
            </button>
            {#if selectedSongs.length > 0}
              <button
                onclick={clearAllSongs}
                class="text-[10px] font-medium px-2 py-1 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer bg-transparent border-none font-sans text-red-400 hover:text-red-500"
              >
                Clear
              </button>
            {/if}
          </div>
        </div>

        <!-- Selected track list (scrollable) -->
        <div class="overflow-y-auto flex-1 px-4 pb-4 space-y-1">
          {#each selectedSongs as song, si (song.id)}
            <div class="group/track w-full py-1.5 px-2 border border-black/8 dark:border-white/8 bg-white dark:bg-card rounded-lg flex items-center gap-1.5 {recentlyAddedId === song.id ? 'song-just-added' : ''}">
              <!-- Drag handle -->
              <div class="shrink-0 opacity-0 group-hover/track:opacity-40 transition-opacity cursor-grab">
                <GripVertical class="w-3.5 h-3.5 text-ink-muted" />
              </div>
              <Music class="w-3.5 h-3.5 text-ink-faint/50 shrink-0" />
              <div class="flex-1 min-w-0">
                <p class="text-[13px] text-ink font-medium truncate">{song.title}</p>
                <p class="text-[10px] text-ink-muted truncate">
                  {selectedOrchestra}{#if song.singer} · {song.singer}{/if}
                </p>
              </div>
              {#if durationMap.get(song.id)}
                <span class="text-[11px] font-mono text-ink-faint shrink-0">{durationMap.get(song.id)}</span>
              {/if}
              <button
                onclick={() => removeSong(song.id)}
                class="text-ink-faint hover:text-tango transition-colors cursor-pointer bg-transparent border-none p-0.5 font-sans text-xs leading-none shrink-0"
              >&times;</button>
            </div>
          {/each}

          {#if selectedSongs.length === 0}
            <div class="flex flex-col items-center justify-center py-12 px-4 text-center">
              <Music class="w-8 h-8 text-ink-faint/40 mb-3" />
              <p class="text-sm text-ink-faint">No tracks yet</p>
              <p class="text-xs text-ink-faint/60 mt-1">Start adding from the right</p>
            </div>
          {/if}
        </div>
      </div>

      <!-- ═══ RIGHT PANE: Search & Browse ═══ -->
      <div class="
        {mobileTab === 'search' ? 'flex' : 'hidden'} md:flex
        flex-col w-full md:w-[60%] overflow-hidden
      ">
        {#if recordings.length > 0}
          <!-- Sticky search + filters -->
          <div class="sticky top-0 bg-white dark:bg-card px-4 pt-4 pb-3 z-10 space-y-2 border-b border-black/5 dark:border-white/5 shrink-0">
            <h4 class="text-xs font-medium text-ink uppercase tracking-widest hidden md:block">Search &amp; Browse</h4>
            <div class="relative">
              <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
              <input
                type="text"
                placeholder="Search {selectedOrchestra} recordings..."
                bind:value={songQuery}
                class="w-full pl-10 pr-4 py-2.5 bg-surface dark:bg-background border border-black/5 dark:border-white/5 rounded-lg text-sm text-ink outline-none focus:border-ink dark:focus:border-white transition-colors font-sans"
              />
            </div>
            <div class="flex gap-2 flex-wrap items-center">
              {#if availableSingers.length > 0}
                <select
                  bind:value={singerFilter}
                  class="text-xs bg-surface dark:bg-background border border-black/5 dark:border-white/5 rounded-lg px-3 py-1.5 text-ink-muted font-sans outline-none"
                >
                  <option value="">All singers</option>
                  {#each availableSingers as s}
                    <option value={s}>{s}</option>
                  {/each}
                </select>
              {/if}
              {#if availableGenres.length > 1}
                <select
                  bind:value={genreFilter}
                  class="text-xs bg-surface dark:bg-background border border-black/5 dark:border-white/5 rounded-lg px-3 py-1.5 text-ink-muted font-sans outline-none"
                >
                  <option value="">All genres</option>
                  {#each availableGenres as g}
                    <option value={g}>{g}</option>
                  {/each}
                </select>
              {/if}
              <select
                bind:value={sortOrder}
                class="text-xs bg-surface dark:bg-background border border-black/5 dark:border-white/5 rounded-lg px-3 py-1.5 text-ink-muted font-sans outline-none"
              >
                <option value="relevance">Relevance</option>
                <option value="date-asc">Date &#8593; oldest</option>
                <option value="date-desc">Date &#8595; newest</option>
              </select>
              <span class="text-[10px] text-ink-faint ml-auto">{filteredRecordings.length} results</span>
            </div>
            {#if availableYears.length > 0}
              <div class="flex gap-2 items-center">
                <span class="text-[10px] text-ink-faint whitespace-nowrap">Year range</span>
                <select
                  bind:value={yearFrom}
                  class="text-xs bg-surface dark:bg-background border border-black/5 dark:border-white/5 rounded-lg px-3 py-1.5 text-ink-muted font-sans outline-none"
                >
                  <option value="">From</option>
                  {#each availableYears as y}
                    <option value={y}>{y}</option>
                  {/each}
                </select>
                <span class="text-[10px] text-ink-faint">–</span>
                <select
                  bind:value={yearTo}
                  class="text-xs bg-surface dark:bg-background border border-black/5 dark:border-white/5 rounded-lg px-3 py-1.5 text-ink-muted font-sans outline-none"
                >
                  <option value="">To</option>
                  {#each availableYears as y}
                    <option value={y}>{y}</option>
                  {/each}
                </select>
              </div>
            {/if}
          </div>

          <!-- Recording results (scrollable) -->
          <div class="overflow-y-auto flex-1">
            <div class="space-y-1 px-4 py-3">
              {#each filteredRecordings as rec}
                {@const alreadyPicked = isAlreadySelected(rec)}
                <button
                  onclick={() => !alreadyPicked && selectRecording(rec)}
                  disabled={alreadyPicked}
                  class="group flex justify-between items-center p-2.5 rounded-xl border w-full text-left cursor-pointer transition-all font-sans
                    {alreadyPicked
                      ? 'border-black/5 dark:border-white/5 bg-surface dark:bg-background opacity-50 cursor-default'
                      : 'border-black/5 dark:border-white/5 hover:border-ink dark:hover:border-white hover:bg-black/5 dark:hover:bg-white/5 bg-white dark:bg-card'}"
                >
                  <div class="min-w-0 flex-1">
                    <p class="text-sm font-medium text-ink truncate">{rec.title}</p>
                    <div class="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      {#if rec.singer && rec.singer !== 'Instrumental' && rec.singer !== '-'}
                        <span class="text-[10px] font-medium px-1.5 py-0.5 rounded-full {getSingerColor(rec.singer)}">{rec.singer}</span>
                      {:else}
                        <span class="text-[10px] font-medium px-1.5 py-0.5 rounded-full {getSingerColor(null)}">Instrumental</span>
                      {/if}
                      {#if rec.recording_date}
                        <span class="text-[10px] text-ink-faint font-mono">{formatRecordingDate(rec.recording_date)}</span>
                      {/if}
                    </div>
                  </div>
                  <div class="flex items-center gap-2 shrink-0 ml-3">
                    {#if rec.duration}
                      <span class="text-[11px] font-mono text-ink-faint">{rec.duration}</span>
                    {/if}
                    {#if alreadyPicked}
                      <div class="w-6 h-6 rounded-full bg-vals/20 flex items-center justify-center">
                        <Check class="w-3.5 h-3.5 text-vals" />
                      </div>
                    {:else}
                      <div class="w-6 h-6 rounded-full border border-black/10 dark:border-white/10 group-hover:bg-ink dark:group-hover:bg-white group-hover:border-ink dark:group-hover:border-white flex items-center justify-center transition-colors">
                        <Plus class="w-4 h-4 text-white dark:text-ink opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    {/if}
                  </div>
                </button>
              {/each}
              {#if filteredRecordings.length === 0 && songQuery.trim()}
                <p class="text-sm text-ink-muted py-4 text-center">No recordings match "{songQuery}"</p>
              {/if}
            </div>

            <!-- YouTube fallback button -->
            <div class="px-4 pb-4 pt-2 border-t border-black/5 dark:border-white/5 mt-2">
              <button
                onclick={() => step = 'youtube'}
                class="w-full flex items-center justify-center gap-2 p-3 border border-dashed border-black/15 dark:border-white/15 rounded-xl text-sm text-ink-muted hover:text-ink hover:border-ink dark:hover:border-white cursor-pointer transition-all font-sans bg-transparent"
              >
                <Search class="w-4 h-4" />
                Can't find it? Search YouTube instead
              </button>
            </div>
          </div>
        {:else}
          <div class="flex-1 flex flex-col items-center justify-center p-8">
            <p class="text-sm text-ink-muted text-center">
              No discography data for "{selectedOrchestra}".
            </p>
            <button
              onclick={() => step = 'youtube'}
              class="mt-4 flex items-center gap-2 px-4 py-2.5 border border-dashed border-black/15 dark:border-white/15 rounded-xl text-sm text-ink-muted hover:text-ink hover:border-ink dark:hover:border-white cursor-pointer transition-all font-sans bg-transparent"
            >
              <Search class="w-4 h-4" />
              Search YouTube instead
            </button>
          </div>
        {/if}
      </div>
    </div>

    <!-- Footer: summary pills + save button -->
    <div class="p-4 border-t border-black/5 dark:border-white/5 bg-surface/50 dark:bg-background/50 shrink-0 space-y-3">
      <button
        onclick={saveTanda}
        disabled={selectedSongs.length === 0}
        class="w-full py-3 bg-ink text-surface rounded-xl text-sm font-medium hover:opacity-80 transition-all cursor-pointer border-none font-sans shadow-lg disabled:opacity-30 disabled:cursor-default flex items-center justify-center gap-2"
      >
        <Check class="w-4 h-4" />
        Save Tanda ({selectedSongs.length} tracks)
      </button>
    </div>
  {/if}

  <!-- STEP: YouTube Search Fallback -->
  {#if step === 'youtube'}
    <div class="flex flex-col grow overflow-hidden">
      <div class="p-4 overflow-y-auto grow">
        <div class="sticky top-0 bg-white dark:bg-card pb-3 z-10">
          <p class="text-xs font-medium text-ink-muted mb-3 uppercase tracking-widest">YouTube Search</p>
          <div class="relative">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
            <input
              type="text"
              placeholder="Search YouTube..."
              bind:value={ytQuery}
              oninput={handleYTSearch}
              class="w-full pl-10 pr-4 py-2.5 bg-surface dark:bg-background border border-black/5 dark:border-white/5 rounded-lg text-sm text-ink outline-none focus:border-ink dark:focus:border-white transition-colors font-sans"
            />
          </div>
          <div class="mt-2 flex gap-2">
            <input
              type="text"
              placeholder="Or paste YouTube URL..."
              bind:value={ytUrlInput}
              onkeydown={(e: KeyboardEvent) => e.key === 'Enter' && handleYTUrl()}
              class="flex-1 bg-surface dark:bg-background border border-black/5 dark:border-white/5 rounded-lg px-3 py-2 text-sm text-ink outline-none focus:border-ink dark:focus:border-white transition-colors font-sans"
            />
            <button
              onclick={handleYTUrl}
              disabled={ytUrlLoading || !ytUrlInput.trim()}
              class="px-4 py-2 bg-ink text-surface rounded-lg text-xs font-medium cursor-pointer border-none font-sans disabled:opacity-30 disabled:cursor-default"
            >
              {ytUrlLoading ? '...' : 'Add'}
            </button>
          </div>
          {#if ytError}<p class="text-xs text-tango mt-2">{ytError}</p>{/if}
        </div>

        {#if ytLoading}
          <p class="text-xs text-ink-muted py-4 text-center">Searching...</p>
        {/if}

        <div class="space-y-1.5 mt-2">
          {#each ytResults as r}
            <button
              onclick={() => addYTResult(r)}
              class="group flex items-center gap-3 p-3 rounded-xl border border-black/5 dark:border-white/5 hover:border-ink dark:hover:border-white hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-all bg-white dark:bg-card w-full text-left font-sans"
            >
              <img
                src={r.thumbnail || `https://img.youtube.com/vi/${r.video_id}/mqdefault.jpg`}
                alt=""
                class="w-16 h-10 object-cover rounded shrink-0"
              />
              <div class="flex-1 min-w-0">
                <p class="text-sm text-ink truncate">{@html r.title}</p>
                <p class="text-xs text-ink-muted">{r.channel}</p>
              </div>
              <Plus class="w-5 h-5 text-ink-faint group-hover:text-ink transition-colors shrink-0" />
            </button>
          {/each}
        </div>
      </div>

      <div class="p-4 border-t border-black/5 dark:border-white/5 bg-surface/50 dark:bg-background/50 shrink-0">
        <button
          onclick={() => step = 'songs'}
          class="w-full py-3 border border-black/10 dark:border-white/10 rounded-xl text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5 transition-all cursor-pointer bg-transparent font-sans flex items-center justify-center gap-2"
        >
          <ArrowLeft class="w-4 h-4" />
          Back to Discography
        </button>
      </div>
    </div>
  {/if}

  <!-- Delete confirmation overlay -->
  {#if showDeleteConfirm}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      class="absolute inset-0 bg-white/95 dark:bg-card/95 z-10 flex flex-col items-center justify-center p-8 gap-4"
      onclick={(e: MouseEvent) => { if (e.target === e.currentTarget) showDeleteConfirm = false; }}
    >
      <Trash2 class="w-8 h-8 text-red-400" />
      <p class="text-sm text-ink text-center font-medium">
        Delete Tanda #{String(slotIndex + 1).padStart(2, '0')}{tanda?.orchestra ? ` (${tanda.orchestra})` : ''}?
      </p>
      <p class="text-xs text-ink-muted text-center">
        {tanda?.songs.length || 0} tracks will be removed. This can't be undone.
      </p>
      <div class="flex gap-3 mt-2">
        <button
          onclick={() => showDeleteConfirm = false}
          class="px-5 py-2.5 rounded-xl border border-black/10 dark:border-white/10 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer bg-transparent font-sans"
        >
          Cancel
        </button>
        <button
          onclick={() => { showDeleteConfirm = false; ondelete?.(); }}
          class="px-5 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors cursor-pointer border-none font-sans flex items-center gap-2"
        >
          <Trash2 class="w-3.5 h-3.5" />
          Delete
        </button>
      </div>
    </div>
  {/if}
</div>
</div>
