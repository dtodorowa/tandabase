<script lang="ts">
  import type { Tanda, Song, Genre } from '$lib/types';
  import { editor } from '$lib/stores/editor.svelte';
  import SongCard from './SongCard.svelte';
  import SongSearch from './SongSearch.svelte';

  let { tanda, expanded, ontoggle, ondragstart, ondragend }: {
    tanda: Tanda;
    expanded: boolean;
    ontoggle: () => void;
    ondragstart: () => void;
    ondragend: () => void;
  } = $props();

  let confirmDelete = $state(false);
  let dragSongIdx = $state<number | null>(null);
  let dragOverSongIdx = $state<number | null>(null);

  const genres: Genre[] = ['Tango', 'Milonga', 'Vals'];

  const genreClass = $derived(tanda.genre.toLowerCase());

  function handleAddSong(song: Song) {
    editor.addSongToTanda(tanda.id, song);
  }

  function handleRemoveSong(songId: string) {
    editor.removeSongFromTanda(tanda.id, songId);
  }

  function handleUpdateSong(songId: string, updates: Partial<Song>) {
    editor.updateSong(tanda.id, songId, updates);
  }

  function handleDelete(e: MouseEvent) {
    e.stopPropagation();
    if (confirmDelete) {
      editor.removeTanda(tanda.id);
    } else {
      confirmDelete = true;
      setTimeout(() => confirmDelete = false, 3000);
    }
  }

  function handleSongDragStart(idx: number) {
    dragSongIdx = idx;
  }
  function handleSongDragOver(e: DragEvent, idx: number) {
    e.preventDefault();
    e.stopPropagation();
    dragOverSongIdx = idx;
  }
  function handleSongDrop(idx: number) {
    if (dragSongIdx !== null && dragSongIdx !== idx) {
      editor.reorderSongs(tanda.id, dragSongIdx, idx);
    }
    dragSongIdx = null;
    dragOverSongIdx = null;
  }
  function handleSongDragEnd() {
    dragSongIdx = null;
    dragOverSongIdx = null;
  }
</script>

<div class="tanda-card {genreClass}" draggable="true" ondragstart={ondragstart} ondragend={ondragend}>
  <!-- Collapsed header (always visible) -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="tanda-header" onclick={ontoggle}>
    <span class="drag-handle" title="Drag to reorder">&#8942;&#8942;</span>
    <span class="tanda-num">#{String(tanda.num).padStart(2, '0')}</span>
    <span class="tanda-title">{tanda.orchestra || 'Untitled'}</span>
    <span class="genre-tag {genreClass}">{tanda.genre}</span>
    <span class="tanda-meta">{tanda.songs.length} songs</span>
    <button class="delete-btn" class:confirm={confirmDelete} onclick={handleDelete} title="Delete tanda">
      {confirmDelete ? 'Confirm?' : '×'}
    </button>
    <span class="chevron" class:open={expanded}>&#9662;</span>
  </div>

  <!-- Expanded body -->
  {#if expanded}
    <div class="tanda-body">
      <div class="tanda-fields">
        <input
          type="text"
          value={tanda.orchestra}
          oninput={(e) => editor.updateTanda(tanda.id, { orchestra: e.currentTarget.value })}
          placeholder="Orchestra name"
          class="field-orchestra"
        />
        <select
          value={tanda.genre}
          onchange={(e) => editor.updateTanda(tanda.id, { genre: e.currentTarget.value as Genre })}
          class="field-genre"
        >
          {#each genres as g}
            <option value={g}>{g}</option>
          {/each}
        </select>
      </div>

      <div class="songs-list">
        {#each tanda.songs as song, si (song.id)}
          <div
            class="song-drop-zone"
            class:drag-over={dragOverSongIdx === si && dragSongIdx !== si}
            ondragover={(e) => handleSongDragOver(e, si)}
            ondrop={() => handleSongDrop(si)}
          >
            <SongCard
              {song}
              onupdate={(updates) => handleUpdateSong(song.id, updates)}
              onremove={() => handleRemoveSong(song.id)}
              ondragstart={() => handleSongDragStart(si)}
              ondragend={handleSongDragEnd}
            />
          </div>
        {/each}
      </div>

      <SongSearch onadd={handleAddSong} />
    </div>
  {/if}
</div>

<style>
  .tanda-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
  }
  .tanda-card.tango   { border-left: 4px solid var(--tango); }
  .tanda-card.milonga { border-left: 4px solid var(--milonga); }
  .tanda-card.vals    { border-left: 4px solid var(--vals); }

  .tanda-header {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    padding: 0.7rem 1rem;
    cursor: pointer;
    transition: background 0.12s;
  }
  .tanda-header:hover { background: var(--surface2); }

  .drag-handle {
    color: var(--text-dim);
    cursor: grab;
    font-size: 1rem;
    letter-spacing: -3px;
    user-select: none;
    flex-shrink: 0;
  }
  .tanda-num {
    font-family: 'JetBrains Mono', monospace;
    font-size: var(--fs-xs);
    color: var(--text-dim);
    font-weight: 600;
    min-width: 24px;
    flex-shrink: 0;
  }
  .tanda-title {
    font-weight: 600;
    font-size: var(--fs-sm);
    flex: 1;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .genre-tag {
    font-size: var(--fs-2xs);
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    padding: 0.1rem 0.4rem;
    border-radius: 3px;
    flex-shrink: 0;
  }
  .genre-tag.tango   { background: rgba(248,113,113,0.15); color: var(--tango); }
  .genre-tag.milonga { background: rgba(96,165,250,0.15); color: var(--milonga); }
  .genre-tag.vals    { background: rgba(74,222,128,0.15); color: var(--vals); }

  .tanda-meta {
    font-size: var(--fs-2xs);
    color: var(--text-dim);
    flex-shrink: 0;
  }
  .delete-btn {
    background: none;
    border: 1px solid transparent;
    color: var(--text-dim);
    font-size: var(--fs-sm);
    padding: 0.15rem 0.4rem;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all 0.15s;
    font-family: 'Outfit', sans-serif;
    flex-shrink: 0;
  }
  .delete-btn:hover { border-color: var(--tango); color: var(--tango); }
  .delete-btn.confirm { background: var(--tango); color: white; border-color: var(--tango); font-size: var(--fs-2xs); }

  .chevron {
    font-size: var(--fs-2xs);
    color: var(--text-dim);
    transition: transform 0.2s;
    flex-shrink: 0;
  }
  .chevron.open { transform: rotate(180deg); }

  /* Expanded body */
  .tanda-body {
    border-top: 1px solid var(--border);
    padding: 1rem;
    background: var(--surface2);
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .tanda-fields {
    display: flex;
    gap: 0.5rem;
  }
  .field-orchestra {
    flex: 1;
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--text);
    border-radius: var(--radius-sm);
    padding: 0.4rem 0.6rem;
    font-size: var(--fs-xs);
    font-weight: 500;
    font-family: 'Outfit', sans-serif;
    outline: none;
  }
  .field-orchestra:focus { border-color: var(--accent); }
  .field-genre {
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--text);
    border-radius: var(--radius-sm);
    padding: 0.4rem 0.5rem;
    font-size: var(--fs-xs);
    font-family: 'Outfit', sans-serif;
    outline: none;
  }
  .field-genre:focus { border-color: var(--accent); }

  .songs-list {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  .song-drop-zone {
    border-radius: var(--radius-sm);
    transition: outline 0.12s;
  }
  .song-drop-zone.drag-over {
    outline: 2px dashed var(--accent);
    outline-offset: 1px;
  }
</style>
