<script lang="ts">
  import { authState } from '$lib/stores/auth.svelte';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { parsePlistXml, type PlistLibrary, type PlistPlaylist } from '$lib/utils/plist-parser';
  import { importPlaylist, type ImportedTanda, type ImportedSong, type ImportResult } from '$lib/utils/playlist-import';
  import { parseCsvToTandas, CSV_EXAMPLE } from '$lib/utils/csv-import';
  import { spotifyToImportResult, isValidSpotifyUrl, extractPlaylistId } from '$lib/utils/spotify-import';
  import {
    fetchAllUserPlaylists,
    fetchPlaylistTracks,
    SpotifyAuthError,
    SpotifyForbiddenError,
    type SpotifyPlaylistSummary,
  } from '$lib/utils/spotify-api';
  import {
    batchSearchYouTube,
    DEFAULT_PREFERRED_CHANNELS,
    YouTubeQuotaError,
    estimateBatchCost,
    getQuotaRemaining,
    getQuotaUsed,
    type BatchSearchItem,
    type BatchSearchResult,
  } from '$lib/utils/youtube';
  import { createSet, updateSet } from '$lib/firebase/db';
  import type { Genre, Song, Tanda } from '$lib/types';
  import GenreBadge from '$lib/components/shared/GenreBadge.svelte';

  // ── State machine: upload → select → preview → search → done ──
  type Step = 'upload' | 'select' | 'preview' | 'searching' | 'done';
  let step = $state<Step>('upload');

  // Import mode toggle
  let importMode = $state<'xml' | 'csv' | 'spotify'>('csv');

  function switchTab(tab: 'xml' | 'csv' | 'spotify') {
    importMode = tab;
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    window.history.replaceState({}, '', url.toString());
  }

  // Upload (XML)
  let dragOver = $state(false);
  let parseError = $state('');

  // CSV
  let csvText = $state('');
  let csvError = $state('');

  // Spotify
  let spotifyUrl = $state('');
  let spotifyError = $state('');
  let spotifyLoading = $state(false);
  let spotifyToken = $state<string | null>(null);
  let spotifyConnecting = $state(false);
  let spotifyPlaylists = $state<SpotifyPlaylistSummary[]>([]);
  let spotifyPlaylistsLoading = $state(false);
  let spotifyMode = $state<'browse' | 'url'>('browse');
  let spotifyFilter = $state('');
  let showYearWarning = $state(false);

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
  let autoSavedId = $state<string | null>(null);
  let autoSaveError = $state('');
  let quotaHit = $state(false);
  let showQuotaWarning = $state(false);
  let quotaEstimate = $state<{ uncached: number; worstCase: number; cached: number; remaining: number } | null>(null);

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

  // ── CSV handling ──
  function handleCsvFile(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files?.[0]) {
      input.files[0].text().then(text => {
        csvText = text;
        processCsv();
      });
    }
  }

  function loadExample() {
    csvText = CSV_EXAMPLE;
  }

  function goToPreview(result: ImportResult, title: string) {
    importResult = result;
    setTitle = title;
    step = 'preview';
    // Show year warning if no songs have years (Spotify/Exportify source)
    const hasAnyYear = result.tandas.some(t => t.songs.some(s => s.year));
    if (!hasAnyYear) showYearWarning = true;
  }

  function processCsv() {
    csvError = '';
    if (!csvText.trim()) {
      csvError = 'Please paste or upload CSV data.';
      return;
    }
    try {
      const result = parseCsvToTandas(csvText);
      goToPreview(result, 'Imported Set');
    } catch (e: any) {
      csvError = e.message || 'Failed to parse CSV.';
    }
  }

  // ── Spotify PKCE OAuth (fully client-side, matching Exportify) ──
  const SPOTIFY_CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID ?? '';

  function getSpotifyRedirectUri(): string {
    const loc = window.location;
    // Spotify bans "localhost" — loopback must use 127.0.0.1 with dynamic port
    if (loc.hostname === 'localhost' || loc.hostname === '127.0.0.1') {
      return `http://127.0.0.1:${loc.port}/import`;
    }
    return `${loc.origin}/import`;
  }

  async function connectToSpotify() {
    // Spotify bans "localhost" — redirect to 127.0.0.1 first so
    // localStorage (per-origin) keeps the code_verifier accessible on callback.
    if (window.location.hostname === 'localhost') {
      const url = new URL(window.location.href);
      url.hostname = '127.0.0.1';
      url.searchParams.set('spotify_connect', '1');
      window.location.href = url.toString();
      return;
    }

    spotifyError = '';
    spotifyConnecting = true;
    try {
      // Generate PKCE verifier + challenge client-side (like Exportify)
      const alphanumeric = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      const codeVerifier = crypto.getRandomValues(new Uint8Array(64))
        .reduce((acc: string, x: number) => acc + alphanumeric[x % alphanumeric.length], '');
      const hashed = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
      const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(hashed)))
        .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

      localStorage.setItem('spotify_code_verifier', codeVerifier);

      const params = new URLSearchParams({
        client_id: SPOTIFY_CLIENT_ID,
        redirect_uri: getSpotifyRedirectUri(),
        scope: 'playlist-read-private playlist-read-collaborative user-library-read',
        response_type: 'code',
        code_challenge_method: 'S256',
        code_challenge: codeChallenge,
      });

      window.location.href = `https://accounts.spotify.com/authorize?${params}`;
    } catch (e: any) {
      spotifyError = e.message || 'Failed to connect to Spotify.';
      spotifyConnecting = false;
    }
  }

  async function handleSpotifyCallback(code: string) {
    spotifyConnecting = true;
    spotifyError = '';
    try {
      const codeVerifier = localStorage.getItem('spotify_code_verifier');
      if (!codeVerifier) throw new Error('Missing code verifier. Please try connecting again.');

      // Exchange code for token directly with Spotify (no server proxy)
      const res = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: SPOTIFY_CLIENT_ID,
          grant_type: 'authorization_code',
          code,
          redirect_uri: getSpotifyRedirectUri(),
          code_verifier: codeVerifier,
        }),
      });

      if (!res.ok) throw new Error('Token exchange failed');

      const data = await res.json();
      localStorage.setItem('spotify_access_token', data.access_token);
      localStorage.setItem('spotify_token_timestamp', Date.now().toString());
      spotifyToken = data.access_token;
      importMode = 'spotify';

      // Clean URL
      window.history.replaceState({}, '', `${window.location.origin}/import?tab=spotify`);

      // Auto-load playlists after auth (like Exportify)
      await loadSpotifyPlaylists(data.access_token);
    } catch (e: any) {
      spotifyError = e.message || 'Failed to complete Spotify login.';
    } finally {
      spotifyConnecting = false;
    }
  }

  function disconnectSpotify() {
    spotifyToken = null;
    spotifyPlaylists = [];
    localStorage.removeItem('spotify_access_token');
    localStorage.removeItem('spotify_token_timestamp');
    localStorage.removeItem('spotify_code_verifier');
    sessionStorage.removeItem('spotify_playlists_cache');
  }

  // ── Load all user playlists (with sessionStorage cache) ──
  const PLAYLIST_CACHE_KEY = 'spotify_playlists_cache';
  const PLAYLIST_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  function getCachedPlaylists(): SpotifyPlaylistSummary[] | null {
    try {
      const raw = sessionStorage.getItem(PLAYLIST_CACHE_KEY);
      if (!raw) return null;
      const { data, timestamp } = JSON.parse(raw);
      if (Date.now() - timestamp > PLAYLIST_CACHE_TTL) {
        sessionStorage.removeItem(PLAYLIST_CACHE_KEY);
        return null;
      }
      return data;
    } catch { return null; }
  }

  function cachePlaylists(data: SpotifyPlaylistSummary[]) {
    try {
      sessionStorage.setItem(PLAYLIST_CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
    } catch { /* quota exceeded — ignore */ }
  }

  async function loadSpotifyPlaylists(token: string) {
    // Try cache first
    const cached = getCachedPlaylists();
    if (cached) {
      spotifyPlaylists = cached;
      return;
    }

    spotifyPlaylistsLoading = true;
    spotifyError = '';
    try {
      spotifyPlaylists = await fetchAllUserPlaylists(token);
      cachePlaylists(spotifyPlaylists);
    } catch (e: any) {
      if (e instanceof SpotifyAuthError || e instanceof SpotifyForbiddenError) {
        disconnectSpotify();
      }
      spotifyError = e.message || 'Failed to load playlists.';
    } finally {
      spotifyPlaylistsLoading = false;
    }
  }

  // ── Select a Spotify playlist from the browser ──
  async function selectSpotifyPlaylist(pl: SpotifyPlaylistSummary) {
    if (!spotifyToken) return;
    spotifyLoading = true;
    spotifyError = '';
    try {
      const data = await fetchPlaylistTracks(spotifyToken, pl.id);

      // Transform to our SpotifyTrack format for spotifyToImportResult
      // Year is deliberately null — Spotify release dates are album/reissue dates,
      // not original recording years (wildly inaccurate for tango).
      const tracks = data.tracks.map((t) => ({
        name: t.name,
        artists: t.artists.map((a) => a.name),
        album: t.album.name,
        year: null as number | null,
        duration_ms: t.duration_ms,
      }));

      const result = spotifyToImportResult({ name: data.name, description: data.description, tracks });
      goToPreview(result, data.name || 'Spotify Import');
    } catch (e: any) {
      if (e instanceof SpotifyAuthError || e instanceof SpotifyForbiddenError) {
        disconnectSpotify();
      }
      spotifyError = e.message || 'Failed to fetch playlist tracks.';
    } finally {
      spotifyLoading = false;
    }
  }

  onMount(() => {
    const urlParams = new URLSearchParams(window.location.search);

    // Handle ?tab=spotify|csv|xml
    const tab = urlParams.get('tab');
    if (tab === 'spotify' || tab === 'csv' || tab === 'xml') {
      importMode = tab;
    }

    // Handle Spotify OAuth error (?error=access_denied for dev-mode restriction)
    const oauthError = urlParams.get('error');
    if (oauthError) {
      importMode = 'spotify';
      spotifyError = oauthError === 'access_denied'
        ? 'SPOTIFY_DEV_MODE'
        : `Spotify login failed: ${oauthError}`;
      window.history.replaceState({}, '', `${window.location.origin}/import?tab=spotify`);
    }

    // Handle Spotify OAuth callback (?code=...)
    const code = urlParams.get('code');
    if (code) {
      handleSpotifyCallback(code);
    } else if (urlParams.get('spotify_connect')) {
      // Auto-trigger after localhost → 127.0.0.1 redirect
      window.history.replaceState({}, '', `${window.location.origin}/import?tab=spotify`);
      connectToSpotify();
    } else {
      // Check for existing valid token (1 hour TTL)
      const savedToken = localStorage.getItem('spotify_access_token');
      const timestamp = parseInt(localStorage.getItem('spotify_token_timestamp') ?? '0', 10);
      if (savedToken && Date.now() - timestamp < 3600000) {
        spotifyToken = savedToken;
        // Auto-load playlists if we have a valid token
        loadSpotifyPlaylists(savedToken);
      }
    }
  });

  // ── Spotify playlist fetch by URL (fallback mode) ──
  async function fetchSpotifyPlaylist() {
    spotifyError = '';
    if (!spotifyUrl.trim()) {
      spotifyError = 'Please enter a Spotify playlist URL.';
      return;
    }
    if (!isValidSpotifyUrl(spotifyUrl)) {
      spotifyError = 'Invalid Spotify playlist URL. Paste a link like https://open.spotify.com/playlist/...';
      return;
    }
    if (!spotifyToken) {
      spotifyError = 'Please connect to Spotify first.';
      return;
    }

    const playlistId = extractPlaylistId(spotifyUrl);
    if (!playlistId) {
      spotifyError = 'Could not extract playlist ID from URL.';
      return;
    }

    spotifyLoading = true;
    try {
      const data = await fetchPlaylistTracks(spotifyToken, playlistId);

      const tracks = data.tracks.map((t) => ({
        name: t.name,
        artists: t.artists.map((a) => a.name),
        album: t.album.name,
        year: null as number | null,
        duration_ms: t.duration_ms,
      }));

      const result = spotifyToImportResult({ name: data.name, description: data.description, tracks });
      goToPreview(result, data.name || 'Spotify Import');
    } catch (e: any) {
      if (e instanceof SpotifyAuthError || e instanceof SpotifyForbiddenError) {
        disconnectSpotify();
      }
      spotifyError = e.message || 'Failed to fetch Spotify playlist.';
    } finally {
      spotifyLoading = false;
    }
  }

  function selectPlaylist(playlist: PlistPlaylist) {
    if (!library) return;
    const result = importPlaylist(library, playlist);
    goToPreview(result, result.playlistName || 'Imported Set');
  }

  // ── YouTube search ──
  function confirmSearch() {
    if (!importResult) return;
    const queries = importResult.tandas.flatMap(t => t.songs.map(s => s.searchQuery));
    const handles = channelHandles.split(',').map(h => h.trim()).filter(Boolean);
    const estimate = estimateBatchCost(queries, handles.length);
    const remaining = getQuotaRemaining();
    quotaEstimate = { ...estimate, remaining };

    if (estimate.uncached === 0) {
      // Everything is cached — skip warning, go straight
      startSearch();
    } else if (estimate.worstCase > remaining) {
      // Will likely exceed quota — show warning
      showQuotaWarning = true;
    } else {
      // Enough budget — show brief confirmation
      showQuotaWarning = true;
    }
  }

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

    try {
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
    } catch (e) {
      if (e instanceof YouTubeQuotaError) {
        quotaHit = true;
        // Mark remaining songs back to pending
        for (const tanda of importResult.tandas) {
          for (const song of tanda.songs) {
            if (song.searchStatus === 'searching') song.searchStatus = 'pending';
          }
        }
        importResult = importResult;
      } else {
        throw e;
      }
    }

    step = 'done';

    // Auto-save immediately — YouTube crawling is expensive
    await autoSave();
  }

  function cancelSearch() {
    abortController?.abort();
    step = 'preview';
  }

  // ── Build tanda payload from import result ──
  function buildTandaPayload() {
    if (!importResult) return null;
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
    return { tandas, genres, songCount };
  }

  // ── Auto-save after YouTube search (runs silently) ──
  async function autoSave() {
    if (!importResult || !authState.user) return;
    autoSaveError = '';
    const payload = buildTandaPayload();
    if (!payload) return;

    try {
      const setId = await createSet({
        title: setTitle || 'Imported Set',
        description: setDescription,
        authorId: authState.user.uid,
        authorName: authState.user.displayName || 'Anonymous',
        visibility: setVisibility,
        genre_summary: payload.genres,
        tanda_count: payload.tandas.length,
        song_count: payload.songCount,
        tandas: payload.tandas,
      });
      autoSavedId = setId;
      console.log('[AutoSave] Set saved as', setId);
    } catch (e: any) {
      console.error('[AutoSave] Failed:', e);
      autoSaveError = e.message || 'Auto-save failed';
    }
  }

  // ── Save / Update to Firestore ──
  async function saveSet() {
    if (!importResult || !authState.user) return;
    saving = true;

    try {
      const payload = buildTandaPayload();
      if (!payload) return;

      const data = {
        title: setTitle,
        description: setDescription,
        authorId: authState.user.uid,
        authorName: authState.user.displayName || 'Anonymous',
        visibility: setVisibility,
        genre_summary: payload.genres,
        tanda_count: payload.tandas.length,
        song_count: payload.songCount,
        tandas: payload.tandas,
      };

      if (autoSavedId) {
        // Update the auto-saved set with any title/description/visibility changes
        await updateSet(autoSavedId, data);
        goto(`/set/${autoSavedId}`);
      } else {
        const setId = await createSet(data);
        goto(`/set/${setId}`);
      }
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
  <title>Import Playlist - Tandabase</title>
</svelte:head>

<div class="import-page">
  <div class="page-header">
    <h1>Import Playlist</h1>
    <p class="subtitle">Create a practica set from a CSV file, Apple Music XML, or Spotify playlist</p>
  </div>

  <!-- STEP 1: Upload -->
  {#if step === 'upload'}
    <div class="import-tabs">
      <button class="import-tab" class:active={importMode === 'csv'} onclick={() => switchTab('csv')}>CSV</button>
      <button class="import-tab" class:active={importMode === 'xml'} onclick={() => switchTab('xml')}>Apple Music</button>
      <button class="import-tab" class:active={importMode === 'spotify'} onclick={() => switchTab('spotify')}>Spotify (beta)</button>
    </div>

    {#if importMode === 'csv'}
      <div class="csv-section">
        <div class="csv-header">
          <p class="csv-hint">Paste your CSV below, or upload a <code>.csv</code> file. Exportify CSVs are also supported.</p>
          <div class="csv-actions">
            <button class="secondary-btn small" onclick={loadExample}>Load example</button>
            <label class="secondary-btn small">
              Upload .csv
              <input type="file" accept=".csv,.txt" onchange={handleCsvFile} hidden />
            </label>
          </div>
        </div>
        <textarea
          class="csv-textarea"
          rows="14"
          placeholder="orchestra,title,year,singer,genre&#10;Di Sarli,Bahía Blanca,1957,,Tango&#10;Di Sarli,A la gran muñeca,1951,,Tango&#10;&#10;D'Arienzo,El flete,1937,,Tango&#10;..."
          bind:value={csvText}
        ></textarea>
        {#if csvError}
          <div class="error-msg" style="white-space: pre-line;">{csvError}</div>
        {/if}
        <div class="csv-format-info">
          <strong>Recommended format:</strong> orchestra, title, year, singer, genre<br/>
          <strong>Singer:</strong> leave empty or write <code>instrumental</code> for instrumental tracks<br/>
          <strong>Genre:</strong> Tango, Vals, or Milonga (defaults to Tango)<br/>
          <strong>Tandas:</strong> separate with a blank row, or consecutive songs with the same orchestra are auto-grouped<br/>
          <strong>Exportify:</strong> CSVs exported from <a href="https://exportify.app" target="_blank" rel="noopener">Exportify</a> are auto-detected and artists are grouped into tandas
        </div>
        <button class="primary-btn" onclick={processCsv} disabled={!csvText.trim()}>
          Parse CSV
        </button>
      </div>
    {:else if importMode === 'xml'}
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
    {:else if importMode === 'spotify'}
      <div class="spotify-section">
        {#if spotifyConnecting}
          <div class="spotify-connecting">
            <p>Connecting to Spotify...</p>
          </div>
          {#if spotifyError}
            <div class="error-msg">{spotifyError}</div>
          {/if}
        {:else if !spotifyToken}
          {#if spotifyError === 'SPOTIFY_DEV_MODE'}
            <div class="dev-mode-notice">
              <h3>Spotify connection unavailable</h3>
              <p>
                Tandabase is currently in <strong>development mode</strong> with Spotify, which means
                only pre-approved accounts can connect directly. (You can send me your email and I can add your account to the list - only 4 slots available, though). I'm working on getting full access approved.
              </p>
              <p><strong>Easy workaround:</strong></p>
              <ol>
                <li>Go to <a href="https://exportify.app" target="_blank" rel="noopener">exportify.app</a> and log in with your Spotify account</li>
                <li>Find your playlist and click <strong>Export</strong> to download a CSV file</li>
                <li>Come back here, switch to the <button class="link-btn" onclick={() => { switchTab('csv'); spotifyError = ''; }}>CSV tab</button>, and upload or paste the file</li>
              </ol>
              <p class="dev-mode-hint">
                Exportify CSVs are auto-detected — artists will be grouped into tandas automatically.
              </p>
            </div>
            <button class="secondary-btn small" onclick={() => spotifyError = ''}>Try connecting anyway</button>
          {:else}
            <p class="csv-hint">Connect your Spotify account to browse and import playlists.</p>
            <button class="primary-btn spotify-connect-btn" onclick={connectToSpotify}>
              Connect to Spotify
            </button>
            {#if spotifyError}
              <div class="error-msg">{spotifyError}</div>
            {/if}
          {/if}
        {:else}
          <div class="spotify-header-row">
            <p class="csv-hint">
              {spotifyPlaylists.length > 0 ? `${spotifyPlaylists.length} playlists` : 'Connected to Spotify'}
            </p>
            <div class="spotify-header-actions">
              <button class="secondary-btn small" onclick={() => spotifyMode = spotifyMode === 'browse' ? 'url' : 'browse'}>
                {spotifyMode === 'browse' ? 'Paste URL instead' : 'Browse playlists'}
              </button>
              <button class="secondary-btn small" onclick={disconnectSpotify}>
                Log out
              </button>
            </div>
          </div>

          {#if spotifyMode === 'browse'}
            {#if spotifyPlaylistsLoading}
              <div class="spotify-loading">Loading your playlists...</div>
            {:else if spotifyPlaylists.length > 0}
              <input
                type="text"
                class="spl-filter"
                placeholder="Filter playlists..."
                bind:value={spotifyFilter}
              />
              <div class="spotify-playlist-list">
                {#each spotifyPlaylists.filter(pl => {
                  if (!spotifyFilter.trim()) return true;
                  const q = spotifyFilter.toLowerCase();
                  return pl.name.toLowerCase().includes(q) || pl.owner.toLowerCase().includes(q);
                }) as pl}
                  <button
                    class="spotify-playlist-row"
                    onclick={() => selectSpotifyPlaylist(pl)}
                    disabled={spotifyLoading}
                  >
                    <span class="spl-name">{pl.name}</span>
                    <span class="spl-meta">{pl.owner} · {pl.trackCount} tracks</span>
                  </button>
                {:else}
                  <p class="csv-hint" style="padding: 0.6rem;">No playlists match "{spotifyFilter}"</p>
                {/each}
              </div>
            {:else}
              {#if spotifyError}
                <div class="error-msg">{spotifyError}</div>
              {:else}
                <p class="csv-hint">No playlists found.</p>
              {/if}
              <button class="secondary-btn small" onclick={() => { if (spotifyToken) loadSpotifyPlaylists(spotifyToken); }}>
                Retry
              </button>
            {/if}
          {:else}
            <div class="spotify-input-row">
              <input
                type="text"
                class="spotify-input"
                placeholder="https://open.spotify.com/playlist/..."
                bind:value={spotifyUrl}
                onkeydown={(e) => { if (e.key === 'Enter') fetchSpotifyPlaylist(); }}
              />
              <button class="primary-btn" onclick={fetchSpotifyPlaylist} disabled={spotifyLoading || !spotifyUrl.trim()}>
                {#if spotifyLoading}
                  Fetching...
                {:else}
                  Import
                {/if}
              </button>
            </div>
          {/if}

          {#if spotifyLoading}
            <div class="spotify-loading">Fetching playlist tracks...</div>
          {/if}
          {#if spotifyError}
            <div class="error-msg">{spotifyError}</div>
          {/if}
        {/if}
      </div>
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

      <div class="quota-info">
        <span class="quota-label">YouTube searches remaining today: <strong>{getQuotaRemaining()}</strong> / 100</span>
      </div>

      <div class="action-bar">
        <button class="primary-btn" onclick={confirmSearch}>
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
      <h2>Search {quotaHit ? 'Interrupted' : 'Complete'}</h2>

      {#if quotaHit}
        <div class="quota-banner">
          <strong>YouTube API quota reached</strong>
          <p>
            This app is still in development, so we're limited to ~10,000 YouTube API calls per day.
            The quota resets at midnight Pacific Time. Any songs found so far have been saved.
          </p>
          <p class="quota-hint">
            A higher quota has been requested from Google — hang tight!
          </p>
        </div>
      {/if}

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

      {#if autoSavedId}
        <div class="autosave-notice">
          Auto-saved as draft. Update title or settings below, then view your set.
        </div>
      {:else if autoSaveError}
        <div class="error-msg">{autoSaveError}</div>
      {/if}

      <div class="action-bar">
        <button class="primary-btn" onclick={saveSet} disabled={saving}>
          {#if saving}
            Saving...
          {:else if autoSavedId}
            Update & View Set
          {:else}
            Save Set
          {/if}
        </button>
        {#if autoSavedId}
          <button class="secondary-btn" onclick={() => goto(`/set/${autoSavedId}`)}>
            View without changes
          </button>
        {/if}
        <button class="secondary-btn" onclick={() => step = 'preview'}>
          ← Back to preview
        </button>
      </div>
    </div>
  {/if}
</div>

<!-- Year warning dialog (Spotify/Exportify sources) -->
{#if showYearWarning}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="dialog-overlay" onclick={() => showYearWarning = false} onkeydown={(e) => { if (e.key === 'Escape') showYearWarning = false; }}>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="dialog-box" onclick={(e) => e.stopPropagation()}>
      <h3>No recording years available</h3>
      <p>
        Spotify and Exportify only provide <strong>album release dates</strong>, which are often
        reissue or compilation dates — not the original recording year.
      </p>
      <p>
        For tango this is especially misleading (e.g. a 1938 recording may show as 2011).
        YouTube searches will use <strong>track name + orchestra</strong> instead, which
        generally produces better results. (But this means that you might have to add the years yourself if you want a complete list)
      </p>
      <button class="primary-btn" onclick={() => showYearWarning = false}>Got it</button>
    </div>
  </div>
{/if}

<!-- Quota warning dialog -->
{#if showQuotaWarning && quotaEstimate}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="dialog-overlay" onclick={() => showQuotaWarning = false} onkeydown={(e) => { if (e.key === 'Escape') showQuotaWarning = false; }}>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="dialog-box" onclick={(e) => e.stopPropagation()}>
      <h3>YouTube Search Budget</h3>
      <p>
        This app is in <strong>development mode</strong> with a shared daily limit of
        <strong>~100 YouTube searches</strong> (resets at midnight PT).
      </p>
      <div class="quota-stats">
        <div class="qs-row">
          <span>Songs to search</span>
          <span><strong>{quotaEstimate.uncached + quotaEstimate.cached}</strong></span>
        </div>
        {#if quotaEstimate.cached > 0}
          <div class="qs-row qs-good">
            <span>Already cached (free)</span>
            <span>{quotaEstimate.cached}</span>
          </div>
        {/if}
        <div class="qs-row">
          <span>New searches needed</span>
          <span><strong>{quotaEstimate.uncached}</strong> (up to {quotaEstimate.worstCase} API calls)</span>
        </div>
        <div class="qs-row {quotaEstimate.worstCase > quotaEstimate.remaining ? 'qs-danger' : 'qs-good'}">
          <span>Budget remaining today</span>
          <span><strong>{quotaEstimate.remaining}</strong></span>
        </div>
      </div>
      {#if quotaEstimate.worstCase > quotaEstimate.remaining}
        <p class="quota-warn-text">
          This may exceed today's quota. The search will stop when the limit is hit —
          any songs found so far will be saved. Try a smaller playlist or wait until tomorrow.
        </p>
      {/if}
      <div class="dialog-actions">
        <button class="primary-btn" onclick={() => { showQuotaWarning = false; startSearch(); }}>
          {quotaEstimate.worstCase > quotaEstimate.remaining ? 'Search anyway' : 'Start search'}
        </button>
        <button class="secondary-btn" onclick={() => showQuotaWarning = false}>Cancel</button>
      </div>
    </div>
  </div>
{/if}

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
    font-size: var(--fs-heading);
    font-weight: 700;
    letter-spacing: -0.02em;
  }
  .subtitle {
    font-size: var(--fs-xs);
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
    font-size: var(--fs-display);
    color: var(--text-dim);
    margin-bottom: 0.5rem;
  }
  .drop-text {
    font-size: var(--fs-sm);
    color: var(--text);
    font-weight: 500;
  }
  .drop-or {
    font-size: var(--fs-2xs);
    color: var(--text-dim);
    margin: 0.5rem 0;
  }
  .file-btn {
    display: inline-block;
    background: var(--accent);
    color: var(--bg);
    padding: 0.5rem 1.2rem;
    border-radius: var(--radius-sm);
    font-size: var(--fs-xs);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
    font-family: 'Outfit', sans-serif;
  }
  .file-btn:hover { background: var(--accent-bright); }
  .drop-hint {
    font-size: var(--fs-label);
    color: var(--text-dim);
    margin-top: 1rem;
    line-height: 1.4;
  }
  .quota-banner {
    background: rgba(255, 183, 77, 0.1);
    border: 1px solid rgba(255, 183, 77, 0.5);
    color: var(--text);
    padding: 1rem 1.2rem;
    border-radius: var(--radius-sm);
    font-size: var(--fs-xs);
    line-height: 1.5;
  }
  .quota-banner strong {
    color: #ffb74d;
    font-size: var(--fs-sm);
  }
  .quota-banner p {
    margin-top: 0.4rem;
  }
  .quota-hint {
    color: var(--text-dim);
    font-style: italic;
  }
  .autosave-notice {
    background: rgba(76, 175, 80, 0.1);
    border: 1px solid rgba(76, 175, 80, 0.5);
    color: #66bb6a;
    padding: 0.6rem 1rem;
    border-radius: var(--radius-sm);
    font-size: var(--fs-xs);
  }
  .error-msg {
    background: rgba(212, 80, 74, 0.1);
    border: 1px solid var(--tango);
    color: var(--tango);
    padding: 0.6rem 1rem;
    border-radius: var(--radius-sm);
    font-size: var(--fs-xs);
  }
  .info-banner {
    background: rgba(59, 130, 246, 0.08);
    border: 1px solid rgba(59, 130, 246, 0.3);
    color: var(--text-mid);
    padding: 0.6rem 1rem;
    border-radius: var(--radius-sm);
    font-size: var(--fs-xs);
    line-height: 1.5;
  }

  /* Step sections */
  .step-section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .step-section h2 {
    font-family: 'Space Grotesk', sans-serif;
    font-size: var(--fs-subheading);
    font-weight: 600;
  }
  .step-hint {
    font-size: var(--fs-xs);
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
  .pl-name { font-size: var(--fs-sm); font-weight: 500; }
  .pl-meta { font-size: var(--fs-2xs); color: var(--text-dim); }

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
    font-size: var(--fs-2xs);
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
    font-size: var(--fs-2xs);
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
    font-size: var(--fs-xs);
    font-family: 'Outfit', sans-serif;
  }
  .setting-row input:focus, .setting-row select:focus { border-color: var(--accent); outline: none; }
  .setting-hint {
    font-size: var(--fs-label);
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
    font-size: var(--fs-xs);
  }
  .tanda-num {
    font-family: monospace;
    font-size: var(--fs-label);
    color: var(--text-dim);
    min-width: 20px;
  }
  .tanda-orch {
    font-weight: 500;
    color: var(--text);
  }
  .tanda-song-count {
    margin-left: auto;
    font-size: var(--fs-label);
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
    font-size: var(--fs-xs);
    transition: background 0.12s;
  }
  .song-preview:hover { background: var(--surface2); }
  .song-preview.found { background: rgba(106, 184, 122, 0.05); }
  .song-preview.not-found { background: rgba(212, 80, 74, 0.04); }
  .sp-index {
    font-family: monospace;
    font-size: var(--fs-label);
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
    font-size: var(--fs-label);
    color: var(--text-dim);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .sp-singer {
    font-size: var(--fs-label);
    color: var(--text-dim);
    font-style: italic;
  }
  .sp-year {
    font-family: monospace;
    font-size: var(--fs-label);
    color: var(--text-dim);
    flex-shrink: 0;
  }
  .sp-status { flex-shrink: 0; font-size: var(--fs-xs); }
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
    font-size: var(--fs-xs);
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
    font-size: var(--fs-label);
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
    font-size: var(--fs-title);
    font-weight: 700;
    color: var(--accent);
  }
  .stat-label {
    font-size: var(--fs-2xs);
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
    font-size: var(--fs-xs);
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
    font-size: var(--fs-xs);
    font-weight: 500;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all 0.12s;
    font-family: 'Outfit', sans-serif;
  }
  .secondary-btn:hover { border-color: var(--accent); color: var(--accent); }
  .secondary-btn:disabled { opacity: 0.5; cursor: default; }

  /* Import mode tabs */
  .import-tabs {
    display: flex;
    gap: 0.25rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 0.2rem;
    width: fit-content;
  }
  .import-tab {
    background: transparent;
    border: none;
    color: var(--text-dim);
    padding: 0.4rem 1rem;
    font-size: var(--fs-xs);
    font-weight: 500;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all 0.12s;
    font-family: 'Outfit', sans-serif;
  }
  .import-tab:hover { color: var(--text); }
  .import-tab.active {
    background: var(--accent-dim);
    color: var(--accent);
    font-weight: 600;
  }

  /* CSV section */
  .csv-section {
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
  }
  .csv-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }
  .csv-hint {
    font-size: var(--fs-xs);
    color: var(--text-mid);
    line-height: 1.4;
  }
  .csv-hint code {
    background: var(--surface2);
    padding: 0.1rem 0.3rem;
    border-radius: 3px;
    font-size: var(--fs-label);
  }
  .csv-actions {
    display: flex;
    gap: 0.4rem;
    flex-shrink: 0;
  }
  .secondary-btn.small {
    padding: 0.3rem 0.7rem;
    font-size: var(--fs-2xs);
    cursor: pointer;
  }
  .csv-textarea {
    width: 100%;
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--text);
    border-radius: var(--radius-sm);
    padding: 0.8rem;
    font-size: var(--fs-xs);
    font-family: 'JetBrains Mono', monospace;
    line-height: 1.5;
    resize: vertical;
    min-height: 160px;
  }
  .csv-textarea:focus { border-color: var(--accent); outline: none; }
  .csv-textarea::placeholder { color: var(--text-dim); }
  .csv-format-info {
    font-size: var(--fs-2xs);
    color: var(--text-dim);
    line-height: 1.6;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 0.6rem 0.8rem;
  }
  .csv-format-info code {
    background: var(--surface2);
    padding: 0.05rem 0.25rem;
    border-radius: 3px;
    font-size: var(--fs-label);
  }

  /* Spotify section */
  .spotify-section {
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
  }
  .spotify-input-row {
    display: flex;
    gap: 0.5rem;
    align-items: stretch;
  }
  .spotify-input {
    flex: 1;
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--text);
    border-radius: var(--radius-sm);
    padding: 0.5rem 0.8rem;
    font-size: var(--fs-xs);
    font-family: 'Outfit', sans-serif;
  }
  .spotify-input:focus { border-color: var(--accent); outline: none; }
  .spotify-input::placeholder { color: var(--text-dim); }
  .spotify-connect-btn {
    align-self: flex-start;
    padding: 0.6rem 1.5rem;
    font-size: var(--fs-sm);
  }
  .spotify-connecting {
    padding: 1rem;
    text-align: center;
    color: var(--text-dim);
  }
  .spotify-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .spotify-header-actions {
    display: flex;
    gap: 0.4rem;
    flex-shrink: 0;
  }
  .spotify-loading {
    padding: 1.5rem;
    text-align: center;
    color: var(--text-dim);
    font-size: var(--fs-xs);
  }
  .spl-filter {
    width: 100%;
    padding: 0.5rem 0.8rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text);
    font-family: 'Outfit', sans-serif;
    font-size: var(--fs-xs);
  }
  .spl-filter:focus { border-color: var(--accent); outline: none; }
  .spl-filter::placeholder { color: var(--text-dim); }
  .spotify-playlist-list {
    display: flex;
    flex-direction: column;
    gap: 1px;
    max-height: 400px;
    overflow-y: auto;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--border);
  }
  .spotify-playlist-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.8rem;
    padding: 0.5rem 0.8rem;
    background: var(--surface);
    border: none;
    cursor: pointer;
    transition: background 0.1s;
    text-align: left;
    color: var(--text);
    font-family: 'Outfit', sans-serif;
  }
  .spotify-playlist-row:hover:not(:disabled) {
    background: var(--surface2);
  }
  .spotify-playlist-row:disabled {
    opacity: 0.6;
    cursor: wait;
  }
  .spl-name {
    font-size: var(--fs-xs);
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    min-width: 0;
  }
  .spl-meta {
    font-size: var(--fs-2xs);
    color: var(--text-dim);
    white-space: nowrap;
    flex-shrink: 0;
  }

  /* Dialog overlay + box */
  .dialog-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }
  .dialog-box {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 1.5rem;
    max-width: 460px;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
  }
  .dialog-box h3 {
    font-family: 'Space Grotesk', sans-serif;
    font-size: var(--fs-sm);
    font-weight: 600;
    margin: 0;
  }
  .dialog-box p {
    font-size: var(--fs-xs);
    color: var(--text-mid);
    line-height: 1.5;
    margin: 0;
  }
  .dialog-box .primary-btn {
    align-self: flex-end;
    margin-top: 0.4rem;
  }
  .dialog-actions {
    display: flex;
    gap: 0.6rem;
    justify-content: flex-end;
    margin-top: 0.4rem;
  }

  /* Quota info + stats */
  .quota-info {
    text-align: center;
    padding: 0.4rem 0;
  }
  .quota-label {
    font-size: var(--fs-2xs);
    color: var(--text-dim);
  }
  .quota-stats {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    padding: 0.6rem 0.8rem;
    background: var(--surface2);
    border-radius: var(--radius-sm);
    font-size: var(--fs-xs);
  }
  .qs-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .qs-good { color: var(--vals); }
  .qs-danger { color: var(--tango); }
  .quota-warn-text {
    font-size: var(--fs-2xs);
    color: var(--tango);
    line-height: 1.5;
    margin: 0;
  }

  /* Dev mode / Exportify fallback notice */
  .dev-mode-notice {
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 1.2rem 1.4rem;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  .dev-mode-notice h3 {
    font-family: 'Space Grotesk', sans-serif;
    font-size: var(--fs-sm);
    font-weight: 600;
    margin: 0;
    color: var(--accent);
  }
  .dev-mode-notice p {
    font-size: var(--fs-xs);
    color: var(--text-mid);
    line-height: 1.5;
    margin: 0;
  }
  .dev-mode-notice ol {
    font-size: var(--fs-xs);
    color: var(--text-mid);
    line-height: 1.7;
    margin: 0;
    padding-left: 1.2rem;
  }
  .dev-mode-notice a {
    color: var(--accent);
    font-weight: 600;
    text-decoration: none;
  }
  .dev-mode-notice a:hover {
    text-decoration: underline;
  }
  .dev-mode-hint {
    font-size: var(--fs-2xs) !important;
    color: var(--text-dim) !important;
    font-style: italic;
  }
  .link-btn {
    background: none;
    border: none;
    color: var(--accent);
    font-weight: 600;
    font-size: inherit;
    font-family: inherit;
    cursor: pointer;
    padding: 0;
    text-decoration: underline;
  }
  .link-btn:hover {
    color: var(--accent-bright);
  }

  @media (max-width: 600px) {
    .import-page { padding: 1rem; }
    .drop-zone { padding: 2rem 1rem; }
    .done-stats { gap: 1rem; }
    .action-bar { flex-direction: column; }
    .csv-header { flex-direction: column; }
  }
</style>
