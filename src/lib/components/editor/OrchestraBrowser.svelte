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
  import { Search, Music, Plus, Check, ArrowLeft, GripVertical, Trash2, X } from 'lucide-svelte';

  let {
    focusedIndex = null,
    onsongschanged,
  }: {
    focusedIndex: number | null;
    onsongschanged?: () => void;
  } = $props();

  // ── View state ──
  type BrowserView = 'orchestras' | 'songs' | 'youtube';
  let view = $state<BrowserView>('orchestras');

  // ── Orchestra search ──
  let orchestraQuery = $state('');

  // ── Genre selection ──
  const genres: Genre[] = ['Tango', 'Milonga', 'Vals'];
  let selectedGenre = $state<Genre>('Tango');

  // ── Discography state ──
  let selectedOrchestra = $state('');
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

  // ── Description ──
  let tandaDescription = $state('');

  // ── Selected songs (local copy while editing) ──
  let selectedSongs = $state<Song[]>([]);

  // ── YouTube fallback ──
  let ytQuery = $state('');
  let ytResults = $state<YTResult[]>([]);
  let ytLoading = $state(false);
  let ytSearched = $state(false);
  let ytUrlInput = $state('');
  let ytUrlLoading = $state(false);
  let ytError = $state('');

  // ── Recently added highlight ──
  let recentlyAddedId = $state<string | null>(null);
  let addAnimTimeout: ReturnType<typeof setTimeout>;

  // ── Duration map ──
  const durationMap = new Map<string, string>();

  // ── Browse mode state (when no tanda is focused) ──
  let browseOrchestra = $state('');
  let browseRecordings = $state<Recording[]>([]);
  let browseLoading = $state(false);
  let browseSingers = $state<string[]>([]);
  let browseQuery = $state('');
  let browseSingerFilter = $state('');
  let browseSortOrder = $state<'relevance' | 'date-asc' | 'date-desc'>('relevance');

  const browsFilteredRecordings = $derived.by(() => {
    let results = searchRecordings(browseRecordings, browseQuery, {
      singer: browseSingerFilter || undefined,
    }, 200);

    if (browseSortOrder === 'date-asc') {
      results = [...results].sort((a, b) => (a.recording_date || '').localeCompare(b.recording_date || ''));
    } else if (browseSortOrder === 'date-desc') {
      results = [...results].sort((a, b) => (b.recording_date || '').localeCompare(a.recording_date || ''));
    }

    return results;
  });

  async function browseLoadOrchestra(name: string) {
    browseOrchestra = name;
    browseLoading = true;
    browseQuery = '';
    browseSingerFilter = '';
    try {
      browseRecordings = await loadDiscography(name);
      browseSingers = getSingers(browseRecordings);
    } catch (e) {
      console.error('Failed to load discography:', e);
      browseRecordings = [];
      browseSingers = [];
    } finally {
      browseLoading = false;
    }
  }

  function browseBack() {
    browseOrchestra = '';
    browseRecordings = [];
    browseSingers = [];
    browseQuery = '';
    browseSingerFilter = '';
  }

  // ── Track which tanda we've initialized for ──
  let initializedForIndex = $state<number | null>(null);

  // ── Derived ──
  const tanda = $derived(focusedIndex !== null ? editor.tandas[focusedIndex] : null);

  const filteredOrchestras = $derived(
    orchestraQuery.trim()
      ? ORCHESTRA_NAMES.filter(o => o.toLowerCase().includes(orchestraQuery.toLowerCase()))
      : ORCHESTRA_NAMES
  );

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

  // When focusedIndex changes, load tanda data
  $effect(() => {
    if (focusedIndex === null) {
      // Reset editing state but preserve browse state
      if (initializedForIndex !== null) {
        view = 'orchestras';
        selectedOrchestra = '';
        recordings = [];
        selectedSongs = [];
        tandaDescription = '';
        songQuery = '';
        singerFilter = '';
        genreFilter = '';
        yearFrom = '';
        yearTo = '';
        initializedForIndex = null;
      }
      return;
    }

    if (focusedIndex === initializedForIndex) return;
    initializedForIndex = focusedIndex;

    const t = editor.tandas[focusedIndex];
    if (!t) return;

    selectedGenre = t.genre;
    tandaDescription = t.description || '';
    selectedSongs = [...t.songs];
    songQuery = '';
    singerFilter = '';
    genreFilter = '';
    yearFrom = '';
    yearTo = '';

    if (t.orchestra) {
      selectedOrchestra = t.orchestra;
      if (ORCHESTRA_NAMES.some(o => o.toLowerCase() === t.orchestra.toLowerCase())) {
        const matchedKey = ORCHESTRA_NAMES.find(o => o.toLowerCase() === t.orchestra.toLowerCase()) || t.orchestra;
        loadOrchestra(matchedKey, true);
      } else {
        recordings = [];
        view = 'songs';
      }
    } else {
      selectedOrchestra = '';
      recordings = [];
      view = 'orchestras';
    }
  });

  // Sync local state back to editor store (debounced to avoid infinite loops)
  let syncTimer: ReturnType<typeof setTimeout>;

  function syncToEditor() {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      if (focusedIndex === null) return;
      const t = editor.tandas[focusedIndex];
      if (!t) return;

      // Build update payload — only include fields that actually changed
      const updates: Partial<import('$lib/types').Tanda> = {};
      if (t.orchestra !== selectedOrchestra) updates.orchestra = selectedOrchestra;
      if (t.genre !== selectedGenre) updates.genre = selectedGenre;
      if ((t.description || '') !== tandaDescription.trim()) updates.description = tandaDescription.trim() || '';

      const currentIds = t.songs.map(s => s.id).join(',');
      const newIds = selectedSongs.map(s => s.id).join(',');
      if (currentIds !== newIds) {
        updates.songs = [...selectedSongs];
      }

      if (Object.keys(updates).length > 0) {
        editor.updateTanda(t.id, updates);
        onsongschanged?.();
      }
    }, 50);
  }

  // Watch for changes and sync
  $effect(() => {
    // Access reactive values to establish dependencies
    const _ = [selectedSongs.length, selectedSongs.map(s => s.id).join(','), selectedOrchestra, selectedGenre, tandaDescription];
    if (focusedIndex !== null && initializedForIndex === focusedIndex) {
      syncToEditor();
    }
  });

  async function loadOrchestra(name: string, keepView = false) {
    selectedOrchestra = name;
    discographyLoading = true;
    try {
      recordings = await loadDiscography(name);
      availableSingers = getSingers(recordings);
      availableGenres = getGenres(recordings);
      availableYears = getUniqueYears(recordings);
      view = 'songs';
    } catch (e) {
      console.error('Failed to load discography:', e);
      recordings = [];
      view = 'songs';
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

  function isAlreadySelected(rec: Recording): boolean {
    return selectedSongs.some(s =>
      s.title === rec.title && (s.year === (parseInt(rec.recording_date) || null))
    );
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

  function handleRecordingDragStart(rec: Recording, event: DragEvent) {
    if (!event.dataTransfer) return;
    event.dataTransfer.effectAllowed = 'copy';
    // Serialize recording + orchestra context as JSON
    const payload = JSON.stringify({
      type: 'recording',
      orchestra: browseOrchestra || selectedOrchestra,
      recording: rec,
    });
    event.dataTransfer.setData('application/x-tandabase-recording', payload);
    event.dataTransfer.setData('text/plain', `${rec.title} – ${rec.singer || 'Instrumental'}`);
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
    view = 'songs';
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

  // Singer color palette
  const SINGER_COLORS = [
    'bg-violet-100 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400',
    'bg-sky-100 text-sky-700 dark:bg-sky-900/20 dark:text-sky-400',
    'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
    'bg-rose-100 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400',
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400',
    'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400',
    'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/20 dark:text-cyan-400',
    'bg-pink-100 text-pink-700 dark:bg-pink-900/20 dark:text-pink-400',
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

<div class="flex flex-col h-full overflow-hidden">

  {#if focusedIndex === null}
    <!-- ═══ NO FOCUS: Interactive orchestra browser ═══ -->
    {#if browseOrchestra && !browseLoading}
      <!-- Browsing a specific orchestra's discography -->
      <div class="px-5 pt-5 pb-3 shrink-0 border-b border-black/5 dark:border-white/5 space-y-2">
        <div class="flex items-center gap-2">
          <button
            onclick={browseBack}
            class="shrink-0 w-7 h-7 rounded-full hover:bg-black/5 dark:hover:bg-white/5 flex items-center justify-center transition-colors cursor-pointer bg-transparent border-none"
            title="Back to orchestra list"
          >
            <ArrowLeft class="w-3.5 h-3.5 text-ink-muted" />
          </button>
          <h3 class="font-serif text-lg text-ink truncate">{browseOrchestra}</h3>
        </div>
        <p class="text-[10px] text-ink-faint pl-9">
          {browseRecordings.length} recordings
          {#if browseSingers.length > 0}· {browseSingers.length} singers{/if}
        </p>

        <!-- Search within discography -->
        <div class="relative">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
          <input
            type="text"
            placeholder="Search recordings..."
            bind:value={browseQuery}
            class="w-full pl-10 pr-4 py-2 bg-surface dark:bg-background border border-black/5 dark:border-white/5 rounded-lg text-sm text-ink outline-none focus:border-ink dark:focus:border-white transition-colors font-sans"
          />
        </div>

        <!-- Filters -->
        <div class="flex gap-2 items-center">
          {#if browseSingers.length > 0}
            <select
              bind:value={browseSingerFilter}
              class="text-xs bg-surface dark:bg-background border border-black/5 dark:border-white/5 rounded-lg px-2.5 py-1.5 text-ink-muted font-sans outline-none"
            >
              <option value="">All singers</option>
              {#each browseSingers as s}
                <option value={s}>{s}</option>
              {/each}
            </select>
          {/if}
          <select
            bind:value={browseSortOrder}
            class="text-xs bg-surface dark:bg-background border border-black/5 dark:border-white/5 rounded-lg px-2.5 py-1.5 text-ink-muted font-sans outline-none"
          >
            <option value="relevance">Relevance</option>
            <option value="date-asc">Oldest first</option>
            <option value="date-desc">Newest first</option>
          </select>
          <span class="text-[10px] text-ink-faint ml-auto">{browsFilteredRecordings.length}</span>
        </div>
      </div>

      <!-- Recording list (read-only browse) -->
      <div class="overflow-y-auto flex-1">
        <div class="space-y-0.5 px-4 py-2">
          {#each browsFilteredRecordings as rec}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              draggable="true"
              role="listitem"
              ondragstart={(e) => handleRecordingDragStart(rec, e)}
              class="py-2 px-2.5 rounded-lg cursor-grab active:cursor-grabbing hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              <p class="text-[13px] font-medium text-ink truncate">{rec.title}</p>
              <div class="flex items-center gap-1.5 mt-0.5 flex-wrap">
                {#if rec.singer && rec.singer !== 'Instrumental' && rec.singer !== '-'}
                  <span class="text-[10px] font-medium px-1.5 py-0.5 rounded-full {getSingerColor(rec.singer)}">{rec.singer}</span>
                {:else}
                  <span class="text-[10px] font-medium px-1.5 py-0.5 rounded-full {getSingerColor(null)}">Instr.</span>
                {/if}
                {#if rec.recording_date}
                  <span class="text-[10px] text-ink-faint font-mono">{formatRecordingDate(rec.recording_date)}</span>
                {/if}
                {#if rec.genre}
                  <span class="text-[10px] text-ink-faint">{rec.genre}</span>
                {/if}
                {#if rec.duration}
                  <span class="text-[10px] font-mono text-ink-faint">{rec.duration}</span>
                {/if}
              </div>
            </div>
          {/each}
          {#if browsFilteredRecordings.length === 0 && browseQuery.trim()}
            <p class="text-sm text-ink-muted py-4 text-center">No recordings match "{browseQuery}"</p>
          {/if}
        </div>

        <div class="px-5 py-4 border-t border-black/5 dark:border-white/5">
          <p class="text-[10px] text-ink-faint text-center leading-relaxed">
            Click a tanda on the right to start building.<br/>
            You'll be able to add songs from this orchestra.
          </p>
        </div>
      </div>

    {:else}
      <!-- Orchestra list view -->
      <div class="px-5 pt-5 pb-3 shrink-0">
        <h3 class="text-xs font-medium text-ink uppercase tracking-widest mb-1">Orchestra Explorer</h3>
        <p class="text-[10px] text-ink-faint mb-3">Browse discographies or click a tanda to start building</p>
        <div class="relative">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
          <input
            type="text"
            placeholder="Search orchestras..."
            bind:value={orchestraQuery}
            class="w-full pl-10 pr-4 py-2.5 bg-surface dark:bg-background border border-black/5 dark:border-white/5 rounded-xl text-sm text-ink outline-none focus:border-ink dark:focus:border-white transition-colors font-sans"
          />
        </div>
      </div>

      <div class="overflow-y-auto flex-1 px-5 pb-5">
        {#if browseLoading}
          <div class="flex items-center justify-center py-8">
            <p class="text-sm text-ink-muted">Loading discography...</p>
          </div>
        {:else}
          <div class="grid grid-cols-2 gap-1.5">
            {#each filteredOrchestras as orch}
              <button
                onclick={() => browseLoadOrchestra(orch)}
                class="p-3 border rounded-xl text-sm text-left cursor-pointer transition-all font-sans
                  border-black/10 dark:border-white/10 hover:border-ink dark:hover:border-white text-ink/70 hover:text-ink bg-transparent hover:bg-black/5 dark:hover:bg-white/5 hover:shadow-sm"
              >
                {orch}
              </button>
            {/each}
          </div>
          {#if filteredOrchestras.length === 0 && orchestraQuery.trim()}
            <p class="text-sm text-ink-muted mt-4 text-center">No orchestras match "{orchestraQuery}"</p>
          {/if}
        {/if}
      </div>
    {/if}

  {:else if view === 'orchestras'}
    <!-- ═══ FOCUSED: Pick orchestra ═══ -->
    <div class="px-5 pt-5 pb-3 shrink-0 border-b border-black/5 dark:border-white/5">
      <div class="flex items-center justify-between mb-3">
        <span class="font-mono text-[10px] text-ink-muted uppercase tracking-widest">
          Tanda #{String((focusedIndex ?? 0) + 1).padStart(2, '0')}
        </span>
      </div>

      <!-- Genre pills -->
      <div class="flex gap-2 mb-4">
        {#each genres as g}
          <button
            onclick={() => selectedGenre = g}
            class="px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer border font-sans
              {selectedGenre === g
                ? 'bg-ink text-surface border-ink'
                : 'bg-transparent text-ink-muted border-black/10 dark:border-white/10 hover:border-black/30 dark:hover:border-white/30'}"
          >
            {g}
          </button>
        {/each}
      </div>

      <div class="relative">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
        <input
          type="text"
          placeholder="Search orchestras..."
          bind:value={orchestraQuery}
          class="w-full pl-10 pr-4 py-2.5 bg-surface dark:bg-background border border-black/5 dark:border-white/5 rounded-xl text-sm text-ink outline-none focus:border-ink dark:focus:border-white transition-colors font-sans"
        />
      </div>
    </div>

    <div class="overflow-y-auto flex-1 px-5 py-3">
      <div class="grid grid-cols-2 gap-1.5">
        {#each filteredOrchestras as orch}
          <button
            onclick={() => loadOrchestra(orch)}
            class="p-3 border rounded-xl text-sm text-left cursor-pointer transition-all font-sans
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
            onclick={() => { selectedOrchestra = orchestraQuery.trim(); recordings = []; view = 'songs'; }}
            class="w-full p-3 border border-dashed border-black/20 dark:border-white/20 rounded-xl text-sm text-ink-muted hover:text-ink hover:border-ink dark:hover:border-white text-left cursor-pointer transition-all font-sans bg-transparent"
          >
            Use custom: <strong class="text-ink">{orchestraQuery.trim()}</strong>
          </button>
        </div>
      {/if}

      {#if discographyLoading}
        <div class="mt-4 text-center">
          <p class="text-sm text-ink-muted">Loading discography...</p>
        </div>
      {/if}
    </div>

  {:else if view === 'songs'}
    <!-- ═══ FOCUSED: Song browser + selected tracks ═══ -->
    <div class="flex flex-col h-full ">

      <!-- Top bar: orchestra name + back + genre -->
      <div class="px-5 pt-4 pb-3 shrink-0 border-b border-black/5 dark:border-white/5 space-y-2">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2 min-w-0">
            <button
              onclick={() => view = 'orchestras'}
              class="shrink-0 w-7 h-7 rounded-full hover:bg-black/5 dark:hover:bg-white/5 flex items-center justify-center transition-colors cursor-pointer bg-transparent border-none"
              title="Change orchestra"
            >
              <ArrowLeft class="w-3.5 h-3.5 text-ink-muted" />
            </button>
            <h3 class="font-serif text-lg text-ink truncate">{selectedOrchestra}</h3>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-widest shrink-0
              {selectedGenre === 'Tango' ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400' :
               selectedGenre === 'Milonga' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' :
               'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'}">
              {selectedGenre}
            </span>
          </div>
          <span class="text-[10px] text-ink-faint font-mono shrink-0">{selectedSongs.length} tracks</span>
        </div>

        <!-- Description -->
        <input
          type="text"
          placeholder="Add a note for this tanda..."
          bind:value={tandaDescription}
          class="w-full bg-surface dark:bg-background border border-black/5 dark:border-white/5 rounded-lg px-3 py-2 text-xs text-ink outline-none focus:border-ink dark:focus:border-white transition-colors font-sans placeholder:text-ink-faint"
        />

        <!-- Search -->
        {#if recordings.length > 0}
          <div class="relative">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
            <input
              type="text"
              placeholder="Search recordings..."
              bind:value={songQuery}
              class="w-full pl-10 pr-4 py-2 bg-surface dark:bg-background border border-black/5 dark:border-white/5 rounded-lg text-sm text-ink outline-none focus:border-ink dark:focus:border-white transition-colors font-sans"
            />
          </div>

          <!-- Filters row -->
          <div class="flex gap-2 flex-wrap items-center">
            {#if availableSingers.length > 0}
              <select
                bind:value={singerFilter}
                class="text-xs bg-surface dark:bg-background border border-black/5 dark:border-white/5 rounded-lg px-2.5 py-1.5 text-ink-muted font-sans outline-none"
              >
                <option value="">All singers</option>
                {#each availableSingers as s}
                  <option value={s}>{s}</option>
                {/each}
              </select>
            {/if}
            <select
              bind:value={sortOrder}
              class="text-xs bg-surface dark:bg-background border border-black/5 dark:border-white/5 rounded-lg px-2.5 py-1.5 text-ink-muted font-sans outline-none"
            >
              <option value="relevance">Relevance</option>
              <option value="date-asc">Oldest first</option>
              <option value="date-desc">Newest first</option>
            </select>
            <span class="text-[10px] text-ink-faint ml-auto">{filteredRecordings.length}</span>
          </div>
        {/if}
      </div>

      <!-- Selected songs strip (collapsible) -->
      {#if selectedSongs.length > 0}
        <div class="px-5 py-2 border-b border-black/5 dark:border-white/5 bg-surface/30 dark:bg-background/30 shrink-0">
          <div class="flex items-center justify-between mb-1.5">
            <span class="text-[10px] font-medium text-ink uppercase tracking-widest">Selected ({selectedSongs.length})</span>
            <button
              onclick={clearAllSongs}
              class="text-[10px] font-medium px-2 py-0.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer bg-transparent border-none font-sans text-red-400 hover:text-red-500"
            >
              Clear
            </button>
          </div>
          <div class="space-y-0.5 max-h-[140px] overflow-y-auto">
            {#each selectedSongs as song (song.id)}
              <div class="flex items-center gap-1.5 py-1 px-1.5 rounded text-xs group/s {recentlyAddedId === song.id ? 'song-just-added' : ''}">
                <Music class="w-3 h-3 text-ink-faint/50 shrink-0" />
                <span class="text-ink font-medium truncate flex-1">{song.title}</span>
                {#if song.singer}
                  <span class="text-[10px] text-ink-muted shrink-0">{song.singer}</span>
                {/if}
                <button
                  onclick={() => removeSong(song.id)}
                  class="text-ink-faint hover:text-tango transition-colors cursor-pointer bg-transparent border-none p-0 font-sans text-xs leading-none shrink-0 opacity-0 group-hover/s:opacity-100"
                >&times;</button>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Recording results -->
      <div class="overflow-y-auto flex-1">
        {#if recordings.length > 0}
          <div class="space-y-0.5 px-4 py-2">
            {#each filteredRecordings as rec}
              {@const alreadyPicked = isAlreadySelected(rec)}
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <button
                onclick={() => !alreadyPicked && selectRecording(rec)}
                disabled={alreadyPicked}
                draggable={!alreadyPicked}
                ondragstart={(e) => handleRecordingDragStart(rec, e)}
                class="group flex justify-between items-center py-2 px-2.5 rounded-lg border w-full text-left transition-all font-sans
                  {alreadyPicked
                    ? 'border-transparent bg-surface dark:bg-background opacity-40 cursor-default'
                    : 'border-transparent hover:border-black/10 dark:hover:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 cursor-grab active:cursor-grabbing'}"
              >
                <div class="min-w-0 flex-1">
                  <p class="text-[13px] font-medium text-ink truncate">{rec.title}</p>
                  <div class="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    {#if rec.singer && rec.singer !== 'Instrumental' && rec.singer !== '-'}
                      <span class="text-[10px] font-medium px-1.5 py-0.5 rounded-full {getSingerColor(rec.singer)}">{rec.singer}</span>
                    {:else}
                      <span class="text-[10px] font-medium px-1.5 py-0.5 rounded-full {getSingerColor(null)}">Instr.</span>
                    {/if}
                    {#if rec.recording_date}
                      <span class="text-[10px] text-ink-faint font-mono">{formatRecordingDate(rec.recording_date)}</span>
                    {/if}
                  </div>
                </div>
                <div class="flex items-center gap-1.5 shrink-0 ml-2">
                  {#if rec.duration}
                    <span class="text-[10px] font-mono text-ink-faint">{rec.duration}</span>
                  {/if}
                  {#if alreadyPicked}
                    <Check class="w-3.5 h-3.5 text-vals" />
                  {:else}
                    <div class="w-5 h-5 rounded-full border border-black/10 dark:border-white/10 group-hover:bg-ink dark:group-hover:bg-white group-hover:border-ink dark:group-hover:border-white flex items-center justify-center transition-colors">
                      <Plus class="w-3 h-3 text-white dark:text-ink opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  {/if}
                </div>
              </button>
            {/each}
            {#if filteredRecordings.length === 0 && songQuery.trim()}
              <p class="text-sm text-ink-muted py-4 text-center">No recordings match "{songQuery}"</p>
            {/if}
          </div>

          <!-- YouTube fallback -->
          <div class="px-4 pb-3 pt-2 border-t border-black/5 dark:border-white/5 mt-1">
            <button
              onclick={() => view = 'youtube'}
              class="w-full flex items-center justify-center gap-2 p-2.5 border border-dashed border-black/15 dark:border-white/15 rounded-lg text-xs text-ink-muted hover:text-ink hover:border-ink dark:hover:border-white cursor-pointer transition-all font-sans bg-transparent"
            >
              <Search class="w-3.5 h-3.5" />
              Search YouTube instead
            </button>
          </div>
        {:else}
          <div class="flex-1 flex flex-col items-center justify-center p-6">
            <p class="text-sm text-ink-muted text-center">
              No discography for "{selectedOrchestra}".
            </p>
            <button
              onclick={() => view = 'youtube'}
              class="mt-3 flex items-center gap-2 px-4 py-2 border border-dashed border-black/15 dark:border-white/15 rounded-lg text-xs text-ink-muted hover:text-ink hover:border-ink dark:hover:border-white cursor-pointer transition-all font-sans bg-transparent"
            >
              <Search class="w-3.5 h-3.5" />
              Search YouTube
            </button>
          </div>
        {/if}
      </div>
    </div>

  {:else if view === 'youtube'}
    <!-- ═══ FOCUSED: YouTube search ═══ -->
    <div class="flex flex-col h-full overflow-hidden">
      <div class="px-5 pt-4 pb-3 shrink-0 border-b border-black/5 dark:border-white/5 space-y-2">
        <div class="flex items-center gap-2">
          <button
            onclick={() => view = 'songs'}
            class="shrink-0 w-7 h-7 rounded-full hover:bg-black/5 dark:hover:bg-white/5 flex items-center justify-center transition-colors cursor-pointer bg-transparent border-none"
          >
            <ArrowLeft class="w-3.5 h-3.5 text-ink-muted" />
          </button>
          <h3 class="text-xs font-medium text-ink uppercase tracking-widest">YouTube Search</h3>
        </div>
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
        <div class="flex gap-2">
          <input
            type="text"
            placeholder="Or paste YouTube URL..."
            bind:value={ytUrlInput}
            onkeydown={(e: KeyboardEvent) => e.key === 'Enter' && handleYTUrl()}
            class="flex-1 bg-surface dark:bg-background border border-black/5 dark:border-white/5 rounded-lg px-3 py-2 text-xs text-ink outline-none focus:border-ink dark:focus:border-white transition-colors font-sans"
          />
          <button
            onclick={handleYTUrl}
            disabled={ytUrlLoading || !ytUrlInput.trim()}
            class="px-3 py-2 bg-ink text-surface rounded-lg text-xs font-medium cursor-pointer border-none font-sans disabled:opacity-30 disabled:cursor-default"
          >
            {ytUrlLoading ? '...' : 'Add'}
          </button>
        </div>
        {#if ytError}<p class="text-xs text-tango mt-1">{ytError}</p>{/if}
      </div>

      <div class="overflow-y-auto flex-1 px-4 py-2">
        {#if ytLoading}
          <p class="text-xs text-ink-muted py-4 text-center">Searching...</p>
        {/if}

        <div class="space-y-1">
          {#each ytResults as r}
            <button
              onclick={() => addYTResult(r)}
              class="group flex items-center gap-2.5 p-2.5 rounded-lg border border-transparent hover:border-black/10 dark:hover:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-all w-full text-left font-sans"
            >
              <img
                src={r.thumbnail || `https://img.youtube.com/vi/${r.video_id}/mqdefault.jpg`}
                alt=""
                class="w-14 h-9 object-cover rounded shrink-0"
              />
              <div class="flex-1 min-w-0">
                <p class="text-xs text-ink truncate">{@html r.title}</p>
                <p class="text-[10px] text-ink-muted">{r.channel}</p>
              </div>
              <Plus class="w-4 h-4 text-ink-faint group-hover:text-ink transition-colors shrink-0" />
            </button>
          {/each}
        </div>

        {#if ytSearched && !ytLoading && ytResults.length === 0 && !ytError}
          <p class="text-xs text-ink-muted py-4 text-center">No results found</p>
        {/if}
      </div>
    </div>
  {/if}
</div>
