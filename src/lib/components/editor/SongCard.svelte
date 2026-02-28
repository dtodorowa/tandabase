<script lang="ts">
  import type { Song } from '$lib/types';

  let { song, onupdate, onremove, ondragstart, ondragend }: {
    song: Song;
    onupdate: (updates: Partial<Song>) => void;
    onremove: () => void;
    ondragstart?: () => void;
    ondragend?: () => void;
  } = $props();
</script>

<div class="song-row" draggable="true" ondragstart={ondragstart} ondragend={ondragend}>
  <span class="drag-handle" title="Drag to reorder">&#8942;&#8942;</span>
  <img
    src={song.thumbnail || `https://img.youtube.com/vi/${song.video_id}/mqdefault.jpg`}
    alt=""
    class="song-thumb"
  />
  <input
    type="text"
    value={song.title}
    oninput={(e) => onupdate({ title: e.currentTarget.value })}
    placeholder="Title"
    class="field-title"
  />
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
  <button class="remove-btn" onclick={onremove} aria-label="Remove song">&times;</button>
</div>

<style>
  .song-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: var(--surface);
    padding: 0.4rem 0.5rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
  }
  .drag-handle {
    color: var(--text-dim);
    cursor: grab;
    font-size: 0.85rem;
    letter-spacing: -3px;
    user-select: none;
    flex-shrink: 0;
    padding: 0 0.2rem;
  }
  .song-thumb {
    width: 44px;
    height: 26px;
    object-fit: cover;
    border-radius: 2px;
    flex-shrink: 0;
  }
  .song-row input {
    background: transparent;
    border: 1px solid transparent;
    color: var(--text);
    border-radius: 3px;
    padding: 0.25rem 0.4rem;
    font-size: var(--fs-xs);
    outline: none;
    font-family: 'Outfit', sans-serif;
  }
  .song-row input:focus { background: var(--bg); border-color: var(--accent); }
  .field-title { flex: 1; min-width: 0; font-weight: 500; }
  .field-singer { width: 200px; flex-shrink: 0; }
  .field-year { width: 70px; flex-shrink: 0; }
  .remove-btn {
    background: none;
    border: none;
    color: var(--text-dim);
    font-size: var(--fs-lead);
    cursor: pointer;
    padding: 0 0.3rem;
    transition: color 0.15s;
    flex-shrink: 0;
    line-height: 1;
  }
  .remove-btn:hover { color: var(--tango); }
</style>
