<script lang="ts">
  import { authState } from '$lib/stores/auth.svelte';
  import { goto } from '$app/navigation';
  import { parsePlistXml, type PlistLibrary, type PlistPlaylist } from '$lib/utils/plist-parser';
  import { importPlaylist, type ImportedTanda, type ImportedSong, type ImportResult } from '$lib/utils/playlist-import';
  import {
    batchSearchYouTube,
    DEFAULT_PREFERRED_CHANNELS,
    type BatchSearchItem,
    type BatchSearchResult,
  } from '$lib/utils/youtube';
  import { createSet } from '$lib/firebase/db';
  import type { Genre, Song, Tanda } from '$lib/types';
  import GenreBadge from '$lib/components/shared/GenreBadge.svelte';

  // ── State machine: upload → select → preview → search → done ──
  type Step = 'upload' | 'select' | 'preview' | 'searching' | 'done';
  let step = $state<Step>('upload');

  // Upload
  let dragOver = $state(false);
  let parseError = $state('');

  // Parsed data
  let library = $state<PlistLibrary | null>(null);
  let playlists = $state<PlistPlaylist[]>([]);

  // Selected playlist & import result
  let importResult = $state<ImportResult | null>(null);

  // Search state
  let searchProgress = $state(0);
  let searchTotal = $state(0);
  let searchLog = $state<string[]>([]);
  let abortController: AbortController | null = null;

  // Preferred channels (editable)
  let channelHandles = $state(DEFAULT_PREFERRED_CHANNELS.join(', '));

  // Save state
  let saving = $state(false);
  let setTitle = $state('');
  let setDescription = $state('');
  let setVisibility = $state<'private' | 'public'>('private');

  $effect(() => {
    if (!authState.loading && !authState.isLoggedIn) {
      goto('/');
    }
  });

  // ── File handling ──
  function handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files?.[0]) processFile(input.files[0]);
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    dragOver = false;
    const file = e.dataTransfer?.files[0];
    if (file) processFile(file);
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    dragOver = true;
  }

  async function processFile(file: File) {
    parseError = '';
    try {
      const text = await file.text();
      library = parsePlistXml(text);
      playlists = library.playlists;

      if (playlists.length === 0) {
        parseError = 'No playlists found in the XML file.';
        return;
      }

      if (playlists.length === 1) {
        // Auto-select if only one playlist
        selectPlaylist(playlists[0]);
      } else {
        step = 'select';
      }
    } catch (e: any) {
      parseError = e.message || 'Failed to parse XML file.';
    }
  }

  function selectPlaylist(playlist: PlistPlaylist) {
    if (!library) return;
    importResult = importPlaylist(library, playlist);
    setTitle = importResult.playlistName || 'Imported Set';
    step = 'preview';
  }

  // ── YouTube search ──
  async function startSearch() {
    if (!importResult) return;
    step = 'searching';
    searchLog = [];
    searchProgress = 0;

    // Build batch items
    const items: BatchSearchItem[] = [];
    for (let ti = 0; ti < importResult.tandas.length; ti++) {
      for (let si = 0; si < importResult.tandas[ti].songs.length; si++) {
        const song = importResult.tandas[ti].songs[si];
        items.push({
          query: song.searchQuery,
          index: ti,
          songIndex: si,
        });
      }
    }
    searchTotal = items.length;

    // Parse channel handles
    const handles = channelHandles.split(',').map(h => h.trim()).filter(Boolean);

    abortController = new AbortController();

    // Mark all as searching
    for (const tanda of importResult.tandas) {
      for (const song of tanda.songs) {
        song.searchStatus = 'searching';
      }
    }

    await batchSearchYouTube(
      items,
      handles,
      (completed, total, result) => {
        searchProgress = completed;
        const tanda = importResult!.tandas[result.index];
        const song = tanda.songs[result.songIndex];

        if (result.result) {
          song.video_id = result.result.video_id;
          song.video_title = result.result.title;
          song.thumbnail = result.result.thumbnail;
          song.searchStatus = 'found';
          const src = result.source === 'channel' ? '♫' : '~';
          searchLog = [...searchLog, `${src} ${song.title} — ${tanda.orchestra}`];
        } else {
          song.searchStatus = 'not_found';
          searchLog = [...searchLog, `✗ ${song.title} — ${tanda.orchestra}`];
        }

        // Force reactivity
        importResult = importResult;
      },
      abortController.signal,
    );

    step = 'done';
  }

  function cancelSearch() {
    abortController?.abort();
    step = 'preview';
  }

  // ── Save to Firestore ──
  async function saveSet() {
    if (!importResult || !authState.user) return;
    saving = true;

    try {
      const tandas: Tanda[] = importResult.tandas.map((t, i) => ({
        id: crypto.randomUUID(),
        num: i + 1,
        orchestra: t.orchestra,
        genre: t.genre,
        songs: t.songs.map(s => ({
          id: crypto.randomUUID(),
          title: s.title,
          singer: s.singer,
          year: s.year,
          video_id: s.video_id,
          video_title: s.video_title || s.title,
          thumbnail: s.thumbnail || '',
        })),
      }));

      const genres: Genre[] = [...new Set(tandas.map(t => t.genre))];
      const songCount = tandas.reduce((sum, t) => sum + t.songs.length, 0);

      const setId = await createSet({
        title: setTitle,
        description: setDescription,
        authorId: authState.user.uid,
        authorName: authState.user.displayName || 'Anonymous',
        visibility: setVisibility,
        genre_summary: genres,
        tanda_count: tandas.length,
        song_count: songCount,
        tandas,
      });

      goto(`/set/${setId}`);
    } catch (e: any) {
      console.error('Failed to save set:', e);
      alert('Failed to save: ' + (e.message || 'Unknown error'));
    } finally {
      saving = false;
    }
  }

  // ── Stats ──
  let stats = $derived.by(() => {
    if (!importResult) return { tandas: 0, songs: 0, found: 0, notFound: 0 };
    const songs = importResult.tandas.flatMap(t => t.songs);
    return {
      tandas: importResult.tandas.length,
      songs: songs.length,
      found: songs.filter(s => s.searchStatus === 'found').length,
      notFound: songs.filter(s => s.searchStatus === 'not_found').length,
    };
  });
</script>

<svelte:head>
  <title>Import Playlist - Practica Set</title>
</svelte:head>

<div class="import-page">
  <div class="page-header">
    <h1>Import Playlist</h1>
    <p class="subtitle">Upload an Apple Music / iTunes XML export to create a practica set</p>
  </div>

  <!-- STEP 1: Upload -->
  {#if step === 'upload'}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      role="button"
      tabindex="0"
      class="drop-zone"
      class:drag-over={dragOver}
      ondrop={handleDrop}
      ondragover={handleDragOver}
      ondragleave={() => dragOver = false}
    >
      <div class="drop-icon">&#9835;</div>
      <p class="drop-text">Drag & drop your XML playlist file here</p>
      <p class="drop-or">or</p>
      <label class="file-btn">
        Choose File
        <input type="file" accept=".xml,.plist" onchange={handleFileSelect} hidden />
      </label>
      <p class="drop-hint">
        Export from Apple Music: File → Library → Export Playlist… → XML
      </p>
    </div>
    {#if parseError}
      <div class="error-msg">{parseError}</div>
    {/if}

  <!-- STEP 2: Select playlist (if multiple) -->
  {:else if step === 'select'}
    <div class="step-section">
      <h2>Select a Playlist</h2>
      <p class="step-hint">Found {playlists.length} playlists in the file.</p>
      <div class="playlist-list">
        {#each playlists as pl}
          <button class="playlist-card" onclick={() => selectPlaylist(pl)}>
            <div class="pl-name">{pl.name || 'Untitled'}</div>
            <div class="pl-meta">{pl.trackIds.length} tracks</div>
          </button>
        {/each}
      </div>
    </div>

  <!-- STEP 3: Preview tandas -->
  {:else if step === 'preview'}
    <div class="step-section">
      <div class="preview-header">
        <div>
          <h2>{importResult?.playlistName || 'Playlist'}</h2>
          <p class="step-hint">
            {stats.tandas} tandas · {stats.songs} songs ·
            {importResult?.cortinas.length ?? 0} cortinas detected
          </p>
        </div>
        <button class="back-btn" onclick={() => { step = 'upload'; importResult = null; library = null; }}>
          ← Start over
        </button>
      </div>

      <!-- Settings -->
      <div class="settings-panel">
        <div class="setting-row">
          <label>Set Title</label>
          <input type="text" bind:value={setTitle} placeholder="Name this set..." />
        </div>
        <div class="setting-row">
          <label>Description</label>
          <input type="text" bind:value={setDescription} placeholder="Optional description..." />
        </div>
        <div class="setting-row">
          <label>Visibility</label>
          <select bind:value={setVisibility}>
            <option value="private">Private</option>
            <option value="public">Public</option>
          </select>
        </div>
        <div class="setting-row">
          <label>Preferred YouTube Channels</label>
          <input type="text" bind:value={channelHandles} placeholder="channel1, channel2..." />
          <span class="setting-hint">Comma-separated handles. Songs will be searched here first.</span>
        </div>
      </div>

      <!-- Tanda list -->
      <div class="tanda-preview-list">
        {#each importResult?.tandas ?? [] as tanda, i}
          <div class="tanda-preview">
            <div class="tanda-preview-header">
              <span class="tanda-num">{String(tanda.num).padStart(2, '0')}</span>
              <span class="tanda-orch">{tanda.orchestra}</span>
              <GenreBadge genre={tanda.genre} size="sm" />
              <span class="tanda-song-count">{tanda.songs.length} songs</span>
            </div>
            <div class="tanda-songs">
              {#each tanda.songs as song, si}
                <div class="song-preview" class:found={song.searchStatus === 'found'} class:not-found={song.searchStatus === 'not_found'}>
                  <span class="sp-index">{si + 1}</span>
                  <div class="sp-info">
                    <span class="sp-title">{song.title}</span>
                    {#if song.singer}
                      <span class="sp-singer">{song.singer}</span>
                    {/if}
                  </div>
                  {#if song.year}
                    <span class="sp-year">{song.year}</span>
                  {/if}
                  {#if song.searchStatus === 'found'}
                    <span class="sp-status found-icon" title={song.video_title}>&#10003;</span>
                  {:else if song.searchStatus === 'not_found'}
                    <span class="sp-status notfound-icon">&#10007;</span>
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        {/each}
      </div>

      <div class="action-bar">
        <button class="primary-btn" onclick={startSearch}>
          Search YouTube ({stats.songs} songs)
        </button>
        <button class="secondary-btn" onclick={saveSet} disabled={saving}>
          Save without videos
        </button>
      </div>
    </div>

  <!-- STEP 4: Searching -->
  {:else if step === 'searching'}
    <div class="step-section">
      <h2>Searching YouTube...</h2>
      <div class="progress-bar">
        <div class="progress-fill" style="width: {searchTotal ? (searchProgress / searchTotal * 100) : 0}%"></div>
      </div>
      <p class="progress-text">{searchProgress} / {searchTotal} songs searched</p>

      <div class="search-log">
        {#each searchLog.slice(-20) as line}
          <div class="log-line">{line}</div>
        {/each}
      </div>

      <button class="secondary-btn" onclick={cancelSearch}>Cancel</button>
    </div>

  <!-- STEP 5: Done -->
  {:else if step === 'done'}
    <div class="step-section">
      <h2>Search Complete</h2>
      <div class="done-stats">
        <div class="stat">
          <span class="stat-num">{stats.found}</span>
          <span class="stat-label">found</span>
        </div>
        <div class="stat">
          <span class="stat-num">{stats.notFound}</span>
          <span class="stat-label">not found</span>
        </div>
        <div class="stat">
          <span class="stat-num">{stats.tandas}</span>
          <span class="stat-label">tandas</span>
        </div>
      </div>

      <!-- Settings before save -->
      <div class="settings-panel">
        <div class="setting-row">
          <label>Set Title</label>
          <input type="text" bind:value={setTitle} />
        </div>
        <div class="setting-row">
          <label>Description</label>
          <input type="text" bind:value={setDescription} placeholder="Optional description..." />
        </div>
        <div class="setting-row">
          <label>Visibility</label>
          <select bind:value={setVisibility}>
            <option value="private">Private</option>
            <option value="public">Public</option>
          </select>
        </div>
      </div>

      <!-- Tanda results -->
      <div class="tanda-preview-list">
        {#each importResult?.tandas ?? [] as tanda}
          <div class="tanda-preview">
            <div class="tanda-preview-header">
              <span class="tanda-num">{String(tanda.num).padStart(2, '0')}</span>
              <span class="tanda-orch">{tanda.orchestra}</span>
              <GenreBadge genre={tanda.genre} size="sm" />
            </div>
            <div class="tanda-songs">
              {#each tanda.songs as song, si}
                <div class="song-preview" class:found={song.searchStatus === 'found'} class:not-found={song.searchStatus === 'not_found'}>
                  {#if song.thumbnail}
                    <img src={song.thumbnail} alt="" class="sp-thumb" />
                  {:else}
                    <span class="sp-index">{si + 1}</span>
                  {/if}
                  <div class="sp-info">
                    <span class="sp-title">{song.title}</span>
                    {#if song.video_title && song.video_title !== song.title}
                      <span class="sp-yt-title">{song.video_title}</span>
                    {/if}
                    {#if song.singer}
                      <span class="sp-singer">{song.singer}</span>
                    {/if}
                  </div>
                  {#if song.searchStatus === 'found'}
                    <span class="sp-status found-icon">&#10003;</span>
                  {:else}
                    <span class="sp-status notfound-icon">&#10007;</span>
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        {/each}
      </div>

      <div class="action-bar">
        <button class="primary-btn" onclick={saveSet} disabled={saving}>
          {saving ? 'Saving...' : 'Save Practica Set'}
        </button>
        <button class="secondary-btn" onclick={() => step = 'preview'}>
          ← Back to preview
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .import-page {
    max-width: 900px;
    margin: 0 auto;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }
  .page-header h1 {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 1.5rem;
    font-weight: 700;
    letter-spacing: -0.02em;
  }
  .subtitle {
    font-size: 0.8rem;
    color: var(--text-dim);
    margin-top: 0.2rem;
  }

  /* Drop zone */
  .drop-zone {
    border: 2px dashed var(--border);
    border-radius: var(--radius);
    padding: 3rem 2rem;
    text-align: center;
    transition: all 0.2s;
    cursor: pointer;
  }
  .drop-zone.drag-over {
    border-color: var(--accent);
    background: var(--accent-dim);
  }
  .drop-icon {
    font-size: 2.5rem;
    color: var(--text-dim);
    margin-bottom: 0.5rem;
  }
  .drop-text {
    font-size: 0.9rem;
    color: var(--text);
    font-weight: 500;
  }
  .drop-or {
    font-size: 0.72rem;
    color: var(--text-dim);
    margin: 0.5rem 0;
  }
  .file-btn {
    display: inline-block;
    background: var(--accent);
    color: var(--bg);
    padding: 0.5rem 1.2rem;
    border-radius: var(--radius-sm);
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
    font-family: 'Outfit', sans-serif;
  }
  .file-btn:hover { background: var(--accent-bright); }
  .drop-hint {
    font-size: 0.68rem;
    color: var(--text-dim);
    margin-top: 1rem;
    line-height: 1.4;
  }
  .error-msg {
    background: rgba(212, 80, 74, 0.1);
    border: 1px solid var(--tango);
    color: var(--tango);
    padding: 0.6rem 1rem;
    border-radius: var(--radius-sm);
    font-size: 0.78rem;
  }

  /* Step sections */
  .step-section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .step-section h2 {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 1.2rem;
    font-weight: 600;
  }
  .step-hint {
    font-size: 0.78rem;
    color: var(--text-dim);
  }

  /* Playlist selection */
  .playlist-list {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .playlist-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.8rem 1rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all 0.12s;
    text-align: left;
    color: var(--text);
    font-family: 'Outfit', sans-serif;
  }
  .playlist-card:hover { border-color: var(--accent); }
  .pl-name { font-size: 0.88rem; font-weight: 500; }
  .pl-meta { font-size: 0.72rem; color: var(--text-dim); }

  /* Preview header */
  .preview-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
  }
  .back-btn {
    background: none;
    border: 1px solid var(--border);
    color: var(--text-dim);
    padding: 0.3rem 0.7rem;
    font-size: 0.7rem;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all 0.12s;
    font-family: 'Outfit', sans-serif;
  }
  .back-btn:hover { border-color: var(--accent); color: var(--accent); }

  /* Settings */
  .settings-panel {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  .setting-row {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }
  .setting-row label {
    font-size: 0.7rem;
    color: var(--text-dim);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .setting-row input, .setting-row select {
    background: var(--surface2);
    border: 1px solid var(--border);
    color: var(--text);
    border-radius: var(--radius-sm);
    padding: 0.4rem 0.6rem;
    font-size: 0.8rem;
    font-family: 'Outfit', sans-serif;
  }
  .setting-row input:focus, .setting-row select:focus { border-color: var(--accent); outline: none; }
  .setting-hint {
    font-size: 0.62rem;
    color: var(--text-dim);
    line-height: 1.3;
  }

  /* Tanda preview */
  .tanda-preview-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .tanda-preview {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
  }
  .tanda-preview-header {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.6rem 0.8rem;
    border-bottom: 1px solid var(--border);
    font-size: 0.8rem;
  }
  .tanda-num {
    font-family: monospace;
    font-size: 0.68rem;
    color: var(--text-dim);
    min-width: 20px;
  }
  .tanda-orch {
    font-weight: 500;
    color: var(--text);
  }
  .tanda-song-count {
    margin-left: auto;
    font-size: 0.65rem;
    color: var(--text-dim);
  }
  .tanda-songs {
    display: flex;
    flex-direction: column;
  }
  .song-preview {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.35rem 0.8rem;
    font-size: 0.76rem;
    transition: background 0.12s;
  }
  .song-preview:hover { background: var(--surface2); }
  .song-preview.found { background: rgba(106, 184, 122, 0.05); }
  .song-preview.not-found { background: rgba(212, 80, 74, 0.04); }
  .sp-index {
    font-family: monospace;
    font-size: 0.62rem;
    color: var(--text-dim);
    min-width: 16px;
    text-align: center;
  }
  .sp-thumb {
    width: 40px;
    height: 23px;
    object-fit: cover;
    border-radius: 2px;
    flex-shrink: 0;
  }
  .sp-info { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .sp-title {
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .sp-yt-title {
    font-size: 0.62rem;
    color: var(--text-dim);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .sp-singer {
    font-size: 0.65rem;
    color: var(--text-dim);
    font-style: italic;
  }
  .sp-year {
    font-family: monospace;
    font-size: 0.65rem;
    color: var(--text-dim);
    flex-shrink: 0;
  }
  .sp-status { flex-shrink: 0; font-size: 0.8rem; }
  .found-icon { color: var(--vals); }
  .notfound-icon { color: var(--tango); }

  /* Progress */
  .progress-bar {
    width: 100%;
    height: 6px;
    background: var(--surface2);
    border-radius: 3px;
    overflow: hidden;
  }
  .progress-fill {
    height: 100%;
    background: var(--accent);
    transition: width 0.2s;
    border-radius: 3px;
  }
  .progress-text {
    font-size: 0.78rem;
    color: var(--text-dim);
    text-align: center;
  }
  .search-log {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 0.6rem;
    max-height: 300px;
    overflow-y: auto;
    font-family: monospace;
    font-size: 0.68rem;
  }
  .log-line {
    padding: 0.15rem 0;
    color: var(--text-mid);
  }

  /* Done stats */
  .done-stats {
    display: flex;
    gap: 2rem;
    justify-content: center;
    padding: 1rem;
  }
  .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.2rem;
  }
  .stat-num {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 1.8rem;
    font-weight: 700;
    color: var(--accent);
  }
  .stat-label {
    font-size: 0.7rem;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  /* Action bar */
  .action-bar {
    display: flex;
    gap: 0.5rem;
    padding: 0.5rem 0;
  }
  .primary-btn {
    background: var(--accent);
    color: var(--bg);
    border: none;
    padding: 0.6rem 1.4rem;
    font-size: 0.82rem;
    font-weight: 600;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all 0.15s;
    font-family: 'Outfit', sans-serif;
  }
  .primary-btn:hover:not(:disabled) { background: var(--accent-bright); }
  .primary-btn:disabled { opacity: 0.5; cursor: default; }
  .secondary-btn {
    background: var(--surface2);
    border: 1px solid var(--border);
    color: var(--text-mid);
    padding: 0.6rem 1.2rem;
    font-size: 0.78rem;
    font-weight: 500;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all 0.12s;
    font-family: 'Outfit', sans-serif;
  }
  .secondary-btn:hover { border-color: var(--accent); color: var(--accent); }
  .secondary-btn:disabled { opacity: 0.5; cursor: default; }

  @media (max-width: 600px) {
    .import-page { padding: 1rem; }
    .drop-zone { padding: 2rem 1rem; }
    .done-stats { gap: 1rem; }
    .action-bar { flex-direction: column; }
  }
</style>
