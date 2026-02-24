<script lang="ts">
  import type { Tanda, Song, Genre } from '$lib/types';
  import { editor } from '$lib/stores/editor.svelte';
  import SongCard from './SongCard.svelte';
  import SongSearch from './SongSearch.svelte';

  let { tanda }: { tanda: Tanda } = $props();

  let confirmDelete = $state(false);

  const genres: Genre[] = ['Tango', 'Milonga', 'Vals'];

  function handleAddSong(song: Song) {
    editor.addSongToTanda(tanda.id, song);
  }

  function handleRemoveSong(songId: string) {
    editor.removeSongFromTanda(tanda.id, songId);
  }

  function handleUpdateSong(songId: string, updates: Partial<Song>) {
    editor.updateSong(tanda.id, songId, updates);
  }

  function handleDelete() {
    if (confirmDelete) {
      editor.removeTanda(tanda.id);
    } else {
      confirmDelete = true;
      setTimeout(() => confirmDelete = false, 3000);
    }
  }
</script>

<div class="tanda-editor">
  <div class="tanda-editor-header">
    <span class="tanda-num">#{tanda.num}</span>
    <input
      type="text"
      value={tanda.orchestra}
      oninput={(e) => editor.updateTanda(tanda.id, { orchestra: e.currentTarget.value })}
      placeholder="Orchestra name"
      class="orchestra-input"
    />
    <select
      value={tanda.genre}
      onchange={(e) => editor.updateTanda(tanda.id, { genre: e.currentTarget.value as Genre })}
    >
      {#each genres as g}
        <option value={g}>{g}</option>
      {/each}
    </select>
    <button class="delete-tanda" class:confirm={confirmDelete} onclick={handleDelete}>
      {confirmDelete ? 'Confirm?' : 'Delete'}
    </button>
  </div>

  <div class="songs-list">
    {#each tanda.songs as song}
      <SongCard
        {song}
        onupdate={(updates) => handleUpdateSong(song.id, updates)}
        onremove={() => handleRemoveSong(song.id)}
      />
    {/each}
  </div>

  <SongSearch onadd={handleAddSong} />
</div>

<style>
  .tanda-editor {
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 1rem;
  }
  .tanda-editor-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }
  .tanda-num {
    font-family: 'JetBrains Mono', monospace;
    font-size: var(--fs-xs);
    color: var(--text-dim);
    font-weight: 600;
    min-width: 24px;
  }
  .orchestra-input {
    flex: 1;
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--text);
    border-radius: var(--radius-sm);
    padding: 0.4rem 0.6rem;
    font-size: var(--fs-xs);
    font-weight: 500;
    font-family: 'Outfit', sans-serif;
  }
  .orchestra-input:focus { border-color: var(--accent); outline: none; }
  select {
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--text);
    border-radius: var(--radius-sm);
    padding: 0.4rem 0.5rem;
    font-size: var(--fs-xs);
    font-family: 'Outfit', sans-serif;
  }
  select:focus { border-color: var(--accent); outline: none; }
  .delete-tanda {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text-dim);
    border-radius: var(--radius-sm);
    padding: 0.35rem 0.6rem;
    font-size: var(--fs-label);
    font-weight: 500;
    transition: all 0.15s;
    font-family: 'Outfit', sans-serif;
  }
  .delete-tanda:hover { border-color: var(--tango); color: var(--tango); }
  .delete-tanda.confirm { background: var(--tango); color: white; border-color: var(--tango); }
  .songs-list {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
</style>
