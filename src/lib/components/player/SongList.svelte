<script lang="ts">
  import type { Song } from '$lib/types';
  import { player } from '$lib/stores/player.svelte';

  let { songs }: { songs: Song[] } = $props();
</script>

<div class="song-list">
  <div class="song-list-label">Songs</div>
  {#each songs as song, i}
    <button
      class="song-item fade-in"
      class:playing={i === player.currentSongIndex}
      style="animation-delay: {i * 0.04}s"
      onclick={() => player.selectSong(i)}
    >
      <div class="eq-icon"><span></span><span></span><span></span></div>
      <span class="song-num">{i + 1}</span>
      <div class="song-details">
        <div class="song-title">{song.title}</div>
        {#if song.singer}
          <div class="song-singer">{song.singer}</div>
        {/if}
      </div>
      {#if song.year}
        <span class="song-year">{song.year}</span>
      {/if}
    </button>
  {/each}
</div>

<style>
  .song-list {
    flex: 1;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--border) transparent;
  }
  .song-list::-webkit-scrollbar { width: 3px; }
  .song-list::-webkit-scrollbar-track { background: transparent; }
  .song-list::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
  .song-list-label {
    font-size: var(--fs-label);
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--text-dim);
    padding: 0.8rem 1.2rem 0.4rem;
  }
  .song-item {
    width: 100%;
    text-align: left;
    padding: 0.7rem 1.2rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    transition: all 0.12s;
    border: none;
    border-left: 2px solid transparent;
    background: transparent;
    color: var(--text);
    font-family: 'Outfit', sans-serif;
  }
  .song-item:hover { background: var(--surface2); }
  .song-item.playing {
    background: var(--accent-dim);
    border-left-color: var(--accent);
  }
  .song-num {
    font-family: 'JetBrains Mono', monospace;
    font-size: var(--fs-xs);
    color: var(--text-dim);
    min-width: 16px;
    text-align: center;
    font-weight: 500;
  }
  .song-item.playing .song-num { display: none; }
  .eq-icon {
    display: none;
    min-width: 16px;
    height: 14px;
    align-items: flex-end;
    justify-content: center;
    gap: 2px;
  }
  .eq-icon span {
    width: 2.5px;
    background: var(--accent);
    border-radius: 1px;
    animation: eq 0.7s ease-in-out infinite alternate;
  }
  .eq-icon span:nth-child(1) { height: 35%; animation-delay: 0s; }
  .eq-icon span:nth-child(2) { height: 80%; animation-delay: 0.15s; }
  .eq-icon span:nth-child(3) { height: 50%; animation-delay: 0.3s; }
  .song-item.playing .eq-icon { display: flex; }
  .song-details { flex: 1; min-width: 0; }
  .song-title {
    font-size: var(--fs-body);
    font-weight: 500;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .song-item.playing .song-title { color: var(--accent-bright); }
  .song-singer {
    font-size: var(--fs-xs);
    color: var(--text-dim);
    font-style: italic;
    margin-top: 0.05rem;
  }
  .song-year {
    font-family: 'JetBrains Mono', monospace;
    font-size: var(--fs-xs);
    color: var(--text-dim);
    font-weight: 500;
    flex-shrink: 0;
  }

  @media (max-width: 700px) {
    .song-item { padding: 0.65rem 1rem; }
  }
</style>
