<script lang="ts">
  import { editor } from '$lib/stores/editor.svelte';
  import {
    ORCHESTRA_NAMES,
    loadDiscography,
    searchRecordings,
    getSingers,
    getGenres,
    type Recording
  } from '$lib/utils/discography';
  import { searchYouTube, extractVideoId, getVideoById, type YTResult } from '$lib/utils/youtube';
  import type { Song, Genre } from '$lib/types';
  import { X, Search, ArrowLeft, Music, Plus, Check, ChevronDown, Trash2 } from 'lucide-svelte';

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
  let genreFilter = $state('');

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

  // Current tanda data
  const tanda = $derived(editor.tandas[slotIndex]);

  // Filtered orchestras
  const filteredOrchestras = $derived(
    orchestraQuery.trim()
      ? ORCHESTRA_NAMES.filter(o => o.toLowerCase().includes(orchestraQuery.toLowerCase()))
      : ORCHESTRA_NAMES
  );

  // Filtered recordings from discography
  const filteredRecordings = $derived(
    searchRecordings(recordings, songQuery, {
      genre: genreFilter || undefined,
      singer: singerFilter || undefined,
    }, 2000)
  );

  // Initialize from existing tanda data if editing (run once on mount)
  let initialized = false;
  $effect(() => {
    if (initialized) return;
    initialized = true;
    if (tanda && tanda.orchestra) {
      selectedOrchestra = tanda.orchestra;
      selectedGenre = tanda.genre;
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
      video_id: '',
      video_title: '',
      thumbnail: '',
    };
    selectedSongs = [...selectedSongs, song];
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
    // Full date: YYYY-MM-DD
    const fullMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (fullMatch) {
      const [, y, m, d] = fullMatch;
      const day = parseInt(d);
      const month = MONTHS[parseInt(m) - 1] || m;
      return `${day} ${month} ${y}`;
    }
    // Year-month: YYYY-MM
    const ymMatch = trimmed.match(/^(\d{4})-(\d{2})$/);
    if (ymMatch) {
      const [, y, m] = ymMatch;
      const month = MONTHS[parseInt(m) - 1] || m;
      return `${month} ${y}`;
    }
    // Year only or anything else
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

<!-- Backdrop -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
  class="fixed inset-0 bg-black/10 z-40 transition-opacity duration-500"
  onclick={onclose}
></div>

<!-- Panel -->
<div class="fixed right-0 top-0 bottom-0 w-full md:w-[480px] bg-white dark:bg-card z-50 shadow-2xl flex flex-col border-l border-black/10 dark:border-white/5 transition-transform duration-500">

  <!-- Header -->
  <div class="p-6 border-b border-black/5 dark:border-white/5 flex justify-between items-center bg-surface/50 dark:bg-background/50 shrink-0">
    <div>
      <span class="font-mono text-[10px] text-ink-muted uppercase tracking-widest">Tanda {String((slotIndex + 1)).padStart(2, '0')}</span>
      <h3 class="font-serif text-3xl text-ink mt-1">
        {#if selectedOrchestra}
          {selectedOrchestra}
        {:else}
          {selectedGenre}
        {/if}
      </h3>
    </div>
    <div class="flex items-center gap-1">
      {#if step !== 'orchestra'}
        <button
          onclick={() => step = 'orchestra'}
          class="w-10 h-10 rounded-full hover:bg-black/5 dark:hover:bg-white/5 flex items-center justify-center transition-colors cursor-pointer bg-transparent border-none"
          title="Back to orchestras"
        >
          <ArrowLeft class="w-5 h-5 text-ink-muted" />
        </button>
      {/if}
      {#if ondelete}
        <button
          onclick={() => showDeleteConfirm = true}
          class="w-10 h-10 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center transition-colors cursor-pointer bg-transparent border-none"
          title="Delete this tanda"
        >
          <Trash2 class="w-4 h-4 text-ink-muted hover:text-red-500 transition-colors" />
        </button>
      {/if}
      <button
        onclick={onclose}
        class="w-10 h-10 rounded-full hover:bg-black/5 dark:hover:bg-white/5 flex items-center justify-center transition-colors cursor-pointer bg-transparent border-none"
      >
        <X class="w-5 h-5 text-ink" />
      </button>
    </div>
  </div>

  <!-- STEP: Orchestra Selection -->
  {#if step === 'orchestra'}
    <div class="flex flex-col grow overflow-hidden">
      <div class="p-6 overflow-y-auto grow">
        <!-- Genre pills -->
        <div class="mb-6">
          <h4 class="text-xs font-medium text-ink uppercase tracking-widest mb-3">Genre</h4>
          <div class="flex gap-2">
            {#each genres as g}
              <button
                onclick={() => selectedGenre = g}
                class="px-4 py-2 rounded-full text-sm font-medium transition-all cursor-pointer border font-sans
                  {selectedGenre === g
                    ? 'bg-ink text-white border-ink dark:bg-white dark:text-ink dark:border-white'
                    : 'bg-transparent text-ink-muted border-black/10 dark:border-white/10 hover:border-black/30 dark:hover:border-white/30'}"
              >
                {g}
              </button>
            {/each}
          </div>
        </div>

        <!-- Orchestra search -->
        <div class="mb-4">
          <h4 class="text-xs font-medium text-ink uppercase tracking-widest border-b border-black/5 dark:border-white/5 pb-2 mb-3">Orchestra</h4>
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
        <div class="grid grid-cols-2 gap-2">
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

  <!-- STEP: Song Selection from Discography -->
  {#if step === 'songs'}
    <div class="flex flex-col grow overflow-hidden">
      <!-- Selected songs summary (sticky top, scrollable) -->
      <div class="bg-white dark:bg-card border-b border-black/5 dark:border-white/5 shrink-0 flex flex-col max-h-[40vh]">
        <div class="flex justify-between items-center p-4 pb-2">
          <h4 class="font-serif text-lg text-ink">
            {selectedOrchestra}
            <span class="text-ink-muted text-sm italic ml-1">{selectedGenre}</span>
          </h4>
          <span class="font-mono text-xs font-bold text-ink">{selectedSongs.length} tracks</span>
        </div>

        <!-- Track list (scrollable) -->
        <div class="overflow-y-auto px-4 pb-4 space-y-1.5">
          {#each selectedSongs as song, si}
            <div class="w-full py-2 px-3 border border-black/10 dark:border-white/10 bg-surface dark:bg-background rounded-lg flex items-center gap-3">
              <span class="text-[10px] font-mono text-ink-muted font-bold">{String(si + 1).padStart(2, '0')}</span>
              <span class="text-sm text-ink font-medium flex-1 truncate">{song.title}</span>
              {#if song.singer}
                <span class="text-[9px] font-medium px-1.5 py-0.5 rounded-full shrink-0 {getSingerColor(song.singer)}">{song.singer}</span>
              {/if}
              {#if song.year}
                <span class="text-[10px] font-mono text-ink-faint shrink-0">{song.year}</span>
              {/if}
              <!-- YouTube status indicator -->
              {#if song.video_id}
                <span class="text-vals text-xs shrink-0" title="YouTube linked: {song.video_title}">&#9658;</span>
              {/if}
              <button
                onclick={() => removeSong(song.id)}
                class="text-ink-faint hover:text-tango transition-colors cursor-pointer bg-transparent border-none p-0 font-sans text-sm"
              >×</button>
            </div>
          {/each}
          {#if selectedSongs.length === 0}
            <div class="w-full py-3 px-3 border border-dashed border-black/15 dark:border-white/15 rounded-lg flex items-center gap-3">
              <span class="text-[10px] font-mono text-ink-faint font-bold">01</span>
              <span class="text-sm text-ink-faint italic">Pick your first track...</span>
            </div>
          {/if}
        </div>
      </div>

      <!-- Song search area -->
      <div class="p-4 overflow-y-auto grow">
        {#if recordings.length > 0}
          <!-- Search + filters -->
          <div class="sticky top-0 bg-white dark:bg-card pb-3 z-10 space-y-2">
            <div class="relative">
              <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
              <input
                type="text"
                placeholder="Search {selectedOrchestra} recordings..."
                bind:value={songQuery}
                class="w-full pl-10 pr-4 py-2.5 bg-surface dark:bg-background border border-black/5 dark:border-white/5 rounded-lg text-sm text-ink outline-none focus:border-ink dark:focus:border-white transition-colors font-sans"
              />
            </div>
            <div class="flex gap-2 flex-wrap">
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
            </div>
            <!-- Select All / Clear buttons -->
            <div class="flex items-center gap-2 mt-2">
              <button
                onclick={selectAllFiltered}
                class="text-[10px] font-medium px-2.5 py-1 rounded-lg border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer bg-transparent font-sans text-ink-muted hover:text-ink"
              >
                + Add all {filteredRecordings.length} shown
              </button>
              {#if selectedSongs.length > 0}
                <button
                  onclick={clearAllSongs}
                  class="text-[10px] font-medium px-2.5 py-1 rounded-lg border border-red-200 dark:border-red-800/30 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer bg-transparent font-sans text-red-400 hover:text-red-500"
                >
                  Clear all
                </button>
              {/if}
              <span class="text-[10px] text-ink-faint ml-auto">{filteredRecordings.length} results</span>
            </div>
          </div>

          <!-- Recording results -->
          <div class="space-y-1.5 mt-2">
            {#each filteredRecordings as rec}
              {@const alreadyPicked = isAlreadySelected(rec)}
              <button
                onclick={() => !alreadyPicked && selectRecording(rec)}
                disabled={alreadyPicked}
                class="group flex justify-between items-center p-3 rounded-xl border w-full text-left cursor-pointer transition-all font-sans
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
                  {#if alreadyPicked}
                    <Check class="w-4 h-4 text-vals" />
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
        {:else}
          <p class="text-sm text-ink-muted py-4 text-center">
            No discography data for "{selectedOrchestra}". Use YouTube search to find songs.
          </p>
        {/if}

        <!-- YouTube fallback button -->
        <div class="mt-6 pt-4 border-t border-black/5 dark:border-white/5">
          <button
            onclick={() => step = 'youtube'}
            class="w-full flex items-center justify-center gap-2 p-3 border border-dashed border-black/15 dark:border-white/15 rounded-xl text-sm text-ink-muted hover:text-ink hover:border-ink dark:hover:border-white cursor-pointer transition-all font-sans bg-transparent"
          >
            <Search class="w-4 h-4" />
            Can't find it? Search YouTube instead
          </button>
        </div>
      </div>

      <!-- Save button -->
      <div class="p-4 border-t border-black/5 dark:border-white/5 bg-surface/50 dark:bg-background/50 shrink-0">
        <button
          onclick={saveTanda}
          disabled={selectedSongs.length === 0}
          class="w-full py-3 bg-ink dark:bg-white text-white dark:text-ink rounded-xl text-sm font-medium hover:opacity-80 transition-all cursor-pointer border-none font-sans shadow-lg disabled:opacity-30 disabled:cursor-default flex items-center justify-center gap-2"
        >
          <Check class="w-4 h-4" />
          Save Tanda ({selectedSongs.length} tracks)
        </button>
      </div>
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
              class="px-4 py-2 bg-ink dark:bg-white text-white dark:text-ink rounded-lg text-xs font-medium cursor-pointer border-none font-sans disabled:opacity-30 disabled:cursor-default"
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
