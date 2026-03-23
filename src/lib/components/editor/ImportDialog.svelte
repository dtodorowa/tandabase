<script lang="ts">
  import { X, Upload, FileSpreadsheet, Music, CheckCircle, AlertTriangle, XCircle, Loader2 } from 'lucide-svelte';
  import { parseCsvToTandas, CSV_EXAMPLE } from '$lib/utils/csv-import';
  import { parsePlistXml } from '$lib/utils/plist-parser';
  import { importPlaylist, type ImportResult, type ImportedTanda } from '$lib/utils/playlist-import';
  import { matchImportAgainstDiscography, type TandaMatchResult } from '$lib/utils/discography-match';
  import type { Tanda, Song } from '$lib/types';

  let { open = false, onclose, onimport }: {
    open?: boolean;
    onclose: () => void;
    onimport: (tandas: Tanda[], title: string) => void;
  } = $props();

  type Step = 'choose' | 'loading' | 'preview';

  let step = $state<Step>('choose');
  let dragOver = $state(false);
  let error = $state('');
  let importResult = $state<ImportResult | null>(null);
  let matchResults = $state<TandaMatchResult[]>([]);
  let fileName = $state('');
  let matching = $state(false);

  // Stats
  let totalSongs = $derived(matchResults.reduce((s, t) => s + t.totalCount, 0));
  let matchedSongs = $derived(matchResults.reduce((s, t) => s + t.matchedCount, 0));
  let unmatchedSongs = $derived(totalSongs - matchedSongs);

  function resetState() {
    step = 'choose';
    error = '';
    importResult = null;
    matchResults = [];
    fileName = '';
    matching = false;
    dragOver = false;
  }

  function handleClose() {
    resetState();
    onclose();
  }

  async function handleFile(file: File) {
    error = '';
    fileName = file.name;
    step = 'loading';

    try {
      const text = await file.text();
      let result: ImportResult;

      if (file.name.endsWith('.xml')) {
        // Apple Music XML
        const library = parsePlistXml(text);
        if (library.playlists.length === 0) {
          throw new Error('No playlists found in this XML file.');
        }
        result = importPlaylist(library, library.playlists[0]);
      } else {
        // CSV
        result = parseCsvToTandas(text);
      }

      importResult = result;

      // Now match against discographies
      matching = true;
      matchResults = await matchImportAgainstDiscography(result.tandas);
      matching = false;
      step = 'preview';
    } catch (e: any) {
      error = e.message || 'Something went wrong reading that file.';
      step = 'choose';
    }
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    dragOver = false;
    const file = e.dataTransfer?.files[0];
    if (file) handleFile(file);
  }

  function handleFileInput(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) handleFile(file);
    input.value = '';
  }

  function handleConfirmImport() {
    if (!matchResults.length) return;

    const tandas: Tanda[] = matchResults.map((mr, i) => {
      const songs: Song[] = mr.results.map(r => {
        const rec = r.recording;
        const s = r.song;
        return {
          id: crypto.randomUUID(),
          title: s.title,
          singer: s.singer,
          year: s.year ?? (rec?.recording_date ? parseInt(rec.recording_date.slice(0, 4), 10) : null),
          video_id: rec?.youtube_id ?? '',
          video_title: rec ? `${rec.title} - ${rec.orchestra}` : '',
          thumbnail: rec?.youtube_id ? `https://img.youtube.com/vi/${rec.youtube_id}/mqdefault.jpg` : '',
        };
      });

      return {
        id: crypto.randomUUID(),
        num: i + 1,
        orchestra: mr.tanda.orchestra,
        genre: mr.tanda.genre,
        songs,
      };
    });

    const title = importResult?.playlistName || '';
    onimport(tandas, title);
    handleClose();
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4" onclick={handleClose}>
    <div class="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>

    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      class="relative bg-card rounded-2xl shadow-2xl border border-black/10 dark:border-white/10 w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden"
      onclick={(e) => e.stopPropagation()}
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-6 pt-6 pb-2 shrink-0">
        <h2 class="font-serif text-2xl text-ink">
          {#if step === 'choose'}Import a set{:else if step === 'loading'}Reading your file...{:else}Review your import{/if}
        </h2>
        <button onclick={handleClose} class="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer bg-transparent border-none transition-colors">
          <X class="w-5 h-5 text-ink-muted" />
        </button>
      </div>

      <!-- Body -->
      <div class="px-6 pb-6 overflow-y-auto flex-1">

        {#if step === 'choose'}
          <p class="text-sm text-ink-muted font-light leading-relaxed mt-1 mb-6">
            Drop in a file and we'll try to match your songs against our discography database. Any songs we recognise will come with videos already linked.
          </p>

          {#if error}
            <div class="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          {/if}

          <!-- Drop zone -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer
              {dragOver ? 'border-ink dark:border-white bg-black/5 dark:bg-white/5' : 'border-black/15 dark:border-white/15 hover:border-black/30 dark:hover:border-white/30'}"
            ondragover={(e) => { e.preventDefault(); dragOver = true; }}
            ondragleave={() => dragOver = false}
            ondrop={handleDrop}
            onclick={() => document.getElementById('import-file-input')?.click()}
          >
            <Upload class="w-8 h-8 text-ink-faint mx-auto mb-3" />
            <p class="text-sm font-medium text-ink mb-1">Drop your file here</p>
            <p class="text-xs text-ink-muted">or click to browse</p>
          </div>

          <input id="import-file-input" type="file" accept=".csv,.xml" class="hidden" onchange={handleFileInput} />

          <!-- Format hints -->
          <div class="mt-6 space-y-3">
            <div class="flex items-start gap-3 p-3 rounded-xl bg-surface dark:bg-background border border-black/5 dark:border-white/5">
              <FileSpreadsheet class="w-5 h-5 text-ink-muted shrink-0 mt-0.5" />
              <div>
                <p class="text-sm font-medium text-ink">CSV</p>
                <p class="text-xs text-ink-muted font-light">Columns: orchestra, title, year, singer, genre. Blank rows separate tandas.</p>
              </div>
            </div>
            <div class="flex items-start gap-3 p-3 rounded-xl bg-surface dark:bg-background border border-black/5 dark:border-white/5">
              <Music class="w-5 h-5 text-ink-muted shrink-0 mt-0.5" />
              <div>
                <p class="text-sm font-medium text-ink">Apple Music XML</p>
                <p class="text-xs text-ink-muted font-light">File → Library → Export Playlist as XML. Cortinas are used as tanda separators.</p>
              </div>
            </div>
          </div>

        {:else if step === 'loading'}
          <div class="py-16 flex flex-col items-center gap-4">
            <Loader2 class="w-8 h-8 text-ink-muted animate-spin" />
            <p class="text-sm text-ink-muted font-light">
              {matching ? 'Matching songs against our discography...' : `Reading ${fileName}...`}
            </p>
          </div>

        {:else if step === 'preview'}
          <!-- Summary -->
          <div class="mt-2 mb-6 flex gap-3">
            <div class="flex-1 p-3 rounded-xl bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/30 text-center">
              <div class="text-2xl font-bold text-green-700 dark:text-green-400">{matchedSongs}</div>
              <div class="text-[10px] uppercase tracking-widest text-green-600 dark:text-green-500 font-medium">Matched</div>
            </div>
            <div class="flex-1 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 text-center">
              <div class="text-2xl font-bold text-amber-700 dark:text-amber-400">{unmatchedSongs}</div>
              <div class="text-[10px] uppercase tracking-widest text-amber-600 dark:text-amber-500 font-medium">Unmatched</div>
            </div>
            <div class="flex-1 p-3 rounded-xl bg-surface dark:bg-background border border-black/5 dark:border-white/5 text-center">
              <div class="text-2xl font-bold text-ink">{matchResults.length}</div>
              <div class="text-[10px] uppercase tracking-widest text-ink-muted font-medium">Tandas</div>
            </div>
          </div>

          {#if unmatchedSongs > 0}
            <div class="mb-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 text-sm text-amber-700 dark:text-amber-400 font-light leading-relaxed">
              {unmatchedSongs} song{unmatchedSongs > 1 ? 's' : ''} couldn't be found in our discography. They'll still be added, just without a video linked.
            </div>
          {/if}

          <!-- Tanda list -->
          <div class="space-y-4 max-h-[40vh] overflow-y-auto pr-1">
            {#each matchResults as mr, ti}
              <div class="rounded-xl border border-black/5 dark:border-white/5 overflow-hidden">
                <div class="px-4 py-2.5 bg-surface dark:bg-background flex items-center gap-2">
                  <span class="font-serif text-sm italic text-ink-faint">{String(ti + 1).padStart(2, '0')}</span>
                  <span class="font-medium text-sm text-ink">{mr.tanda.orchestra}</span>
                  <span class="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-widest
                    {mr.tanda.genre === 'Tango' ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400' :
                     mr.tanda.genre === 'Milonga' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' :
                     'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'}"
                  >{mr.tanda.genre}</span>
                  {#if !mr.orchestraKey}
                    <span class="ml-auto text-[10px] text-amber-600 dark:text-amber-400 font-medium uppercase tracking-wider">Unknown orchestra</span>
                  {:else}
                    <span class="ml-auto text-[10px] text-ink-faint">{mr.matchedCount}/{mr.totalCount}</span>
                  {/if}
                </div>
                <div class="divide-y divide-black/5 dark:divide-white/5">
                  {#each mr.results as r, si}
                    <div class="px-4 py-2 flex items-center gap-2 text-sm">
                      {#if r.confidence === 'exact'}
                        <CheckCircle class="w-3.5 h-3.5 text-green-500 shrink-0" />
                      {:else if r.confidence === 'high'}
                        <CheckCircle class="w-3.5 h-3.5 text-green-400 shrink-0" />
                      {:else if r.confidence === 'low'}
                        <AlertTriangle class="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      {:else}
                        <XCircle class="w-3.5 h-3.5 text-ink-faint shrink-0" />
                      {/if}
                      <span class="text-ink truncate flex-1">{r.song.title}</span>
                      {#if r.song.singer}
                        <span class="text-[10px] text-ink-muted shrink-0">{r.song.singer}</span>
                      {/if}
                      {#if r.recording?.youtube_id}
                        <span class="text-[10px] text-green-500 shrink-0">&#9658;</span>
                      {/if}
                    </div>
                  {/each}
                </div>
              </div>
            {/each}
          </div>

          <!-- Actions -->
          <div class="mt-6 flex gap-3">
            <button
              onclick={() => { resetState(); }}
              class="flex-1 py-3 rounded-xl border border-black/10 dark:border-white/10 text-sm font-medium text-ink hover:bg-black/5 dark:hover:bg-white/5 transition-all cursor-pointer bg-transparent font-sans"
            >
              Start over
            </button>
            <button
              onclick={handleConfirmImport}
              class="flex-1 py-3 rounded-xl bg-ink text-surface text-sm font-medium hover:opacity-90 transition-all cursor-pointer border-none font-sans shadow-lg"
            >
              Import {matchResults.length} tandas
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}
