<script lang="ts">
  import type { Song } from '$lib/types';

  let { song, onupdate, onremove }: {
    song: Song;
    onupdate: (updates: Partial<Song>) => void;
    onremove: () => void;
  } = $props();
</script>

<div class="song-card">
  <img
    src={song.thumbnail || `https://img.youtube.com/vi/${song.video_id}/mqdefault.jpg`}
    alt=""
    class="song-thumb"
  />
  <div class="song-fields">
    <input
      type="text"
      value={song.title}
      oninput={(e) => onupdate({ title: e.currentTarget.value })}
      placeholder="Title"
      class="field-title"
    />
    <div class="field-row">
      <input
        type="text"
        value={song.singer ?? ''}
        oninput={(e) => onupdate({ singer: e.currentTarget.value || null })}
        placeholder="Singer"
        class="field-singer"
      />
      <input
        type="number"
        value={song.year ?? ''}
        oninput={(e) => onupdate({ year: e.currentTarget.value ? Number(e.currentTarget.value) : null })}
        placeholder="Year"
        class="field-year"
      />
    </div>
  </div>
  <button class="remove-btn" onclick={onremove} aria-label="Remove song">&times;</button>
</div>

<style>
  .song-card {
    display: flex;
    align-items: flex-start;
    gap: 0.6rem;
    padding: 0.5rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
  }
  .song-thumb {
    width: 60px;
    height: 34px;
    object-fit: cover;
    border-radius: 3px;
    flex-shrink: 0;
    margin-top: 0.15rem;
  }
  .song-fields {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .song-fields input {
    background: var(--surface2);
    border: 1px solid var(--border);
    color: var(--text);
    border-radius: 3px;
    padding: 0.25rem 0.5rem;
    font-size: var(--fs-xs);
    outline: none;
    font-family: 'Outfit', sans-serif;
  }
  .song-fields input:focus { border-color: var(--accent); }
  .field-title { font-weight: 500; }
  .field-row { display: flex; gap: 0.25rem; }
  .field-singer { flex: 1; }
  .field-year { width: 60px; }
  .remove-btn {
    background: none;
    border: none;
    color: var(--text-dim);
    font-size: var(--fs-lead);
    cursor: pointer;
    padding: 0.1rem 0.3rem;
    transition: color 0.15s;
    flex-shrink: 0;
  }
  .remove-btn:hover { color: var(--tango); }
</style>
