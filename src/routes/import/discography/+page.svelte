<script lang="ts">
  import { authState } from '$lib/stores/auth.svelte';
  import { goto } from '$app/navigation';
  import { ORCHESTRAS, ORCHESTRA_NAMES, loadDiscography, type Recording } from '$lib/utils/discography';
  import { createSet } from '$lib/firebase/db';
  import type { Genre, Song, Tanda } from '$lib/types';
  import GenreBadge from '$lib/components/shared/GenreBadge.svelte';

  // ── State ──
  type Step = 'select' | 'preview' | 'importing' | 'done';
  let step = $state<Step>('select');

  // Selection
  let selectedOrchestras = $state<Set<string>>(new Set());
  let selectAll = $state(false);

  // Preview
  let previewData = $state<PreviewOrchestra[]>([]);
  let loadingPreview = $state(false);

  // Import
  let importProgress = $state(0);
  let importTotal = $state(0);
  let importLog = $state<string[]>([]);
  let createdSets = $state<{ name: string; id: string }[]>([]);

  interface PreviewOrchestra {
    name: string;
    totalTracks: number;
    tangoCount: number;
    milongaCount: number;
    valsCount: number;
    otherCount: number;
    tandaCount: number;
    withVideo: number;
    recordings: Recording[];
  }

  // ── Genre mapping ──
  function mapGenre(raw: string): Genre | null {
    const g = raw.toLowerCase();
    if (g.startsWith('tango') || g === 'candombe' || g === 'cancion-tango') return 'Tango';
    if (g.startsWith('milonga')) return 'Milonga';
    if (g.startsWith('vals')) return 'Vals';
    return null; // skip non-danceable genres
  }

  // ── Group recordings into tandas ──
  function buildTandas(recordings: Recording[], orchestraKey: string): Tanda[] {
    // Filter to danceable genres and group by genre
    const byGenre: Record<Genre, Recording[]> = { Tango: [], Milonga: [], Vals: [] };

    for (const rec of recordings) {
      const genre = mapGenre(rec.genre);
      if (genre) {
        byGenre[genre].push(rec);
      }
    }

    const tandas: Tanda[] = [];
    let tandaNum = 1;

    for (const genre of ['Tango', 'Milonga', 'Vals'] as Genre[]) {
      const recs = byGenre[genre];
      // Sort by date, then by rating (desc)
      recs.sort((a, b) => {
        if (a.recording_date && b.recording_date) {
          return a.recording_date.localeCompare(b.recording_date);
        }
        if (a.recording_date) return -1;
        if (b.recording_date) return 1;
        return (b.rating ?? 0) - (a.rating ?? 0);
      });

      // Create tandas of 4 songs (3 for milongas)
      const size = genre === 'Milonga' ? 3 : 4;
      for (let i = 0; i < recs.length; i += size) {
        const chunk = recs.slice(i, i + size);
        if (chunk.length < 2) continue; // skip lone songs

        const tanda: Tanda = {
          id: crypto.randomUUID(),
          num: tandaNum++,
          orchestra: orchestraKey,
          genre,
          songs: chunk.map(rec => recordingToSong(rec)),
        };
        tandas.push(tanda);
      }
    }

    return tandas;
  }

  function recordingToSong(rec: Recording): Song {
    const year = rec.recording_date
      ? parseInt(rec.recording_date.substring(0, 4)) || null
      : null;

    return {
      id: crypto.randomUUID(),
      title: rec.title,
      singer: rec.singer && rec.singer !== 'Instrumental' && rec.singer !== '-'
        ? rec.singer
        : null,
      year,
      video_id: rec.youtube_id || '',
      video_title: rec.youtube_id ? `${rec.orchestra} - ${rec.title}` : '',
      thumbnail: rec.youtube_id
        ? `https://img.youtube.com/vi/${rec.youtube_id}/mqdefault.jpg`
        : '',
    };
  }

  // ── Actions ──
  function toggleOrchestra(name: string) {
    const next = new Set(selectedOrchestras);
    if (next.has(name)) {
      next.delete(name);
    } else {
      next.add(name);
    }
    selectedOrchestras = next;
  }

  function toggleAll() {
    if (selectAll) {
      selectedOrchestras = new Set();
      selectAll = false;
    } else {
      selectedOrchestras = new Set(ORCHESTRA_NAMES);
      selectAll = true;
    }
  }

  async function loadPreviews() {
    loadingPreview = true;
    previewData = [];

    for (const name of ORCHESTRA_NAMES) {
      if (!selectedOrchestras.has(name)) continue;

      try {
        const recs = await loadDiscography(name);
        const tangos = recs.filter(r => mapGenre(r.genre) === 'Tango');
        const milongas = recs.filter(r => mapGenre(r.genre) === 'Milonga');
        const valses = recs.filter(r => mapGenre(r.genre) === 'Vals');
        const others = recs.filter(r => mapGenre(r.genre) === null);
        const withVideo = recs.filter(r => r.youtube_id).length;

        const tandas = buildTandas(recs, name);

        previewData = [...previewData, {
          name,
          totalTracks: recs.length,
          tangoCount: tangos.length,
          milongaCount: milongas.length,
          valsCount: valses.length,
          otherCount: others.length,
          tandaCount: tandas.length,
          withVideo,
          recordings: recs,
        }];
      } catch (e) {
        console.error(`Failed to load ${name}:`, e);
      }
    }

    loadingPreview = false;
    step = 'preview';
  }

  async function startImport() {
    if (!authState.user) return;

    step = 'importing';
    importTotal = previewData.length;
    importProgress = 0;
    importLog = [];
    createdSets = [];

    for (const orch of previewData) {
      importLog = [...importLog, `Creating set for ${orch.name}...`];

      try {
        const tandas = buildTandas(orch.recordings, orch.name);

        const genres: Genre[] = [];
        if (tandas.some(t => t.genre === 'Tango')) genres.push('Tango');
        if (tandas.some(t => t.genre === 'Milonga')) genres.push('Milonga');
        if (tandas.some(t => t.genre === 'Vals')) genres.push('Vals');

        const songCount = tandas.reduce((sum, t) => sum + t.songs.length, 0);
        const withVideo = tandas.reduce(
          (sum, t) => sum + t.songs.filter(s => s.video_id).length, 0
        );

        const setId = await createSet({
          title: `${orch.name} — Complete Discography`,
          description: `Full discography of ${orch.name}: ${songCount} tracks in ${tandas.length} tandas. ${withVideo} tracks have YouTube videos pre-assigned.`,
          authorId: authState.user.uid,
          authorName: authState.user.displayName || 'Unknown',
          visibility: 'private',
          genre_summary: genres,
          tanda_count: tandas.length,
          song_count: songCount,
          tandas,
        });

        createdSets = [...createdSets, { name: orch.name, id: setId }];
        importLog = [...importLog, `  ✓ ${orch.name}: ${tandas.length} tandas, ${songCount} songs (${withVideo} with video)`];
      } catch (e: any) {
        importLog = [...importLog, `  ✗ ${orch.name}: ${e.message}`];
      }

      importProgress++;
    }

    step = 'done';
  }

  // ── Lifecycle ──
  // Wait for auth to finish loading before checking login
  $effect(() => {
    if (!authState.loading && !authState.user) {
      goto('/');
    }
  });
</script>

<svelte:head>
  <title>Import Discographies | Tandabase</title>
</svelte:head>

<main class="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] p-4 md:p-8">
  <div class="max-w-4xl mx-auto">
    <div class="mb-8">
      <a href="/import" class="text-[var(--accent)] hover:underline text-sm">← Back to Import</a>
      <h1 class="text-2xl font-bold mt-2">Import Discographies</h1>
      <p class="text-[var(--text-secondary)] mt-1">
        Create private sets from your tango discography database. Each orchestra becomes a set with tracks
        auto-grouped into tandas by genre.
      </p>
    </div>

    {#if authState.loading}
      <div class="bg-[var(--bg-secondary)] rounded-lg p-8 text-center">
        <p class="text-[var(--text-secondary)]">Loading...</p>
      </div>

    {:else if !authState.user}
      <div class="bg-[var(--bg-secondary)] rounded-lg p-8 text-center">
        <p class="text-[var(--text-secondary)]">Please sign in to import discographies.</p>
      </div>

    {:else if step === 'select'}
      <!-- Orchestra selection -->
      <div class="bg-[var(--bg-secondary)] rounded-lg p-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold">Select Orchestras</h2>
          <button
            onclick={toggleAll}
            class="text-sm text-[var(--accent)] hover:underline"
          >
            {selectAll ? 'Deselect All' : 'Select All'}
          </button>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {#each ORCHESTRA_NAMES as name}
            <button
              onclick={() => toggleOrchestra(name)}
              class="px-3 py-2 rounded-md text-sm text-left transition-colors
                {selectedOrchestras.has(name)
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/80'}"
            >
              {name}
            </button>
          {/each}
        </div>

        <div class="mt-6 flex items-center justify-between">
          <span class="text-sm text-[var(--text-secondary)]">
            {selectedOrchestras.size} orchestra{selectedOrchestras.size !== 1 ? 's' : ''} selected
          </span>
          <button
            onclick={loadPreviews}
            disabled={selectedOrchestras.size === 0 || loadingPreview}
            class="px-6 py-2 rounded-md bg-[var(--accent)] text-white font-medium
              disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
          >
            {loadingPreview ? 'Loading...' : 'Preview →'}
          </button>
        </div>
      </div>

    {:else if step === 'preview'}
      <!-- Preview -->
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold">Preview</h2>
          <button
            onclick={() => { step = 'select'; previewData = []; }}
            class="text-sm text-[var(--accent)] hover:underline"
          >
            ← Change selection
          </button>
        </div>

        <div class="bg-[var(--bg-secondary)] rounded-lg overflow-hidden">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-[var(--border-color)]">
                <th class="text-left p-3 font-medium">Orchestra</th>
                <th class="text-right p-3 font-medium">Tracks</th>
                <th class="text-right p-3 font-medium">Tandas</th>
                <th class="text-right p-3 font-medium hidden sm:table-cell">T / M / V</th>
                <th class="text-right p-3 font-medium">With Video</th>
              </tr>
            </thead>
            <tbody>
              {#each previewData as orch}
                <tr class="border-b border-[var(--border-color)]/50">
                  <td class="p-3 font-medium">{orch.name}</td>
                  <td class="p-3 text-right">{orch.totalTracks}</td>
                  <td class="p-3 text-right">{orch.tandaCount}</td>
                  <td class="p-3 text-right hidden sm:table-cell text-[var(--text-secondary)]">
                    {orch.tangoCount} / {orch.milongaCount} / {orch.valsCount}
                  </td>
                  <td class="p-3 text-right">
                    <span class="{orch.withVideo > 0 ? 'text-green-500' : 'text-[var(--text-secondary)]'}">
                      {orch.withVideo}
                    </span>
                  </td>
                </tr>
              {/each}
            </tbody>
            <tfoot>
              <tr class="font-semibold">
                <td class="p-3">Total</td>
                <td class="p-3 text-right">{previewData.reduce((s, o) => s + o.totalTracks, 0)}</td>
                <td class="p-3 text-right">{previewData.reduce((s, o) => s + o.tandaCount, 0)}</td>
                <td class="p-3 text-right hidden sm:table-cell text-[var(--text-secondary)]">
                  {previewData.reduce((s, o) => s + o.tangoCount, 0)} /
                  {previewData.reduce((s, o) => s + o.milongaCount, 0)} /
                  {previewData.reduce((s, o) => s + o.valsCount, 0)}
                </td>
                <td class="p-3 text-right text-green-500">
                  {previewData.reduce((s, o) => s + o.withVideo, 0)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {#if previewData.some(o => o.otherCount > 0)}
          <p class="text-xs text-[var(--text-secondary)]">
            Note: Non-danceable genres (fox-trot, rumba, etc.) are excluded.
            {previewData.reduce((s, o) => s + o.otherCount, 0)} tracks skipped.
          </p>
        {/if}

        <div class="flex justify-end gap-3">
          <button
            onclick={() => { step = 'select'; previewData = []; }}
            class="px-4 py-2 rounded-md bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:opacity-80"
          >
            Cancel
          </button>
          <button
            onclick={startImport}
            class="px-6 py-2 rounded-md bg-[var(--accent)] text-white font-medium hover:opacity-90 transition-opacity"
          >
            Create {previewData.length} Sets
          </button>
        </div>
      </div>

    {:else if step === 'importing'}
      <!-- Importing progress -->
      <div class="bg-[var(--bg-secondary)] rounded-lg p-6 space-y-4">
        <h2 class="text-lg font-semibold">Importing...</h2>

        <div class="w-full bg-[var(--bg-tertiary)] rounded-full h-2">
          <div
            class="bg-[var(--accent)] h-2 rounded-full transition-all duration-300"
            style="width: {importTotal > 0 ? (importProgress / importTotal) * 100 : 0}%"
          ></div>
        </div>

        <p class="text-sm text-[var(--text-secondary)]">
          {importProgress} / {importTotal} orchestras
        </p>

        <div class="bg-[var(--bg-primary)] rounded-md p-3 max-h-64 overflow-y-auto font-mono text-xs">
          {#each importLog as line}
            <div class="py-0.5">{line}</div>
          {/each}
        </div>
      </div>

    {:else if step === 'done'}
      <!-- Done -->
      <div class="space-y-4">
        <div class="bg-[var(--bg-secondary)] rounded-lg p-6">
          <h2 class="text-lg font-semibold mb-2">Import Complete</h2>
          <p class="text-[var(--text-secondary)]">
            Created {createdSets.length} private sets. You can now browse each one and assign YouTube
            videos to tracks that don't have them yet.
          </p>
        </div>

        <div class="bg-[var(--bg-secondary)] rounded-lg p-3 max-h-80 overflow-y-auto font-mono text-xs">
          {#each importLog as line}
            <div class="py-0.5">{line}</div>
          {/each}
        </div>

        <div class="bg-[var(--bg-secondary)] rounded-lg p-4 space-y-2">
          <h3 class="font-medium text-sm mb-3">Created Sets:</h3>
          {#each createdSets as set}
            <a
              href="/set/{set.id}"
              class="block px-3 py-2 rounded-md bg-[var(--bg-tertiary)] hover:bg-[var(--bg-tertiary)]/80 text-sm transition-colors"
            >
              {set.name} — Complete Discography →
            </a>
          {/each}
        </div>

        <div class="flex gap-3">
          <a
            href="/my-sets"
            class="px-6 py-2 rounded-md bg-[var(--accent)] text-white font-medium hover:opacity-90 transition-opacity"
          >
            Go to My Sets
          </a>
          <button
            onclick={() => { step = 'select'; previewData = []; createdSets = []; importLog = []; }}
            class="px-4 py-2 rounded-md bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:opacity-80"
          >
            Import More
          </button>
        </div>
      </div>
    {/if}
  </div>
</main>
