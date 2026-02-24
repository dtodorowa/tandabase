<script lang="ts">
  import type { Tanda } from '$lib/types';
  import { player } from '$lib/stores/player.svelte';

  let { tandas, onclose }: { tandas: Tanda[]; onclose?: () => void } = $props();

  function getYearRange(tanda: Tanda): string {
    const years = tanda.songs.map(s => s.year).filter((y): y is number => y !== null).sort();
    if (!years.length) return '';
    return years[0] === years[years.length - 1] ? String(years[0]) : `${years[0]}\u2013${years[years.length - 1]}`;
  }

  function handleClick(index: number) {
    player.selectTanda(index);
    onclose?.();
  }
</script>

<div class="sidebar-label">Tandas</div>
{#each tandas as tanda, i}
  {@const yr = getYearRange(tanda)}
  <button
    class="tanda-item"
    class:active={i === player.currentTandaIndex}
    onclick={() => handleClick(i)}
  >
    <span class="tanda-num">{String(tanda.num).padStart(2, '0')}</span>
    <div class="tanda-info">
      <div class="tanda-name">{tanda.orchestra}</div>
      <div class="tanda-meta">
        <span class="genre-tag {tanda.genre}">{tanda.genre}</span>
        {#if yr}<span>{yr}</span>{/if}
        <span>&middot; {tanda.songs.length}</span>
      </div>
    </div>
  </button>
{/each}

<style>
  .sidebar-label {
    font-size: 0.8rem;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--text-dim);
    padding: 1rem 1rem 0.5rem;
  }
  .tanda-item {
    width: 100%;
    text-align: left;
    padding: 0.65rem 1rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.65rem;
    transition: all 0.12s ease;
    border: none;
    border-left: 2px solid transparent;
    background: transparent;
    color: var(--text);
    font-family: 'Outfit', sans-serif;
  }
  .tanda-item:hover { background: var(--surface2); }
  .tanda-item.active {
    background: var(--accent-dim);
    border-left-color: var(--accent);
  }
  .tanda-num {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.8rem;
    color: var(--text-dim);
    min-width: 18px;
    font-weight: 500;
  }
  .tanda-item.active .tanda-num { color: var(--accent); }
  .tanda-info { flex: 1; min-width: 0; }
  .tanda-name {
    font-size: 1rem;
    font-weight: 500;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .tanda-item.active .tanda-name { color: var(--accent-bright); }
  .tanda-meta {
    font-size: 0.7rem;
    color: var(--text-dim);
    margin-top: 0.1rem;
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }
  .genre-tag {
    display: inline-flex;
    align-items: center;
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    padding: 0.1rem 0.4rem;
    border-radius: 3px;
  }
  .genre-tag.Tango   { background: rgba(248,113,113,0.1); color: var(--tango); }
  .genre-tag.Milonga { background: rgba(96,165,250,0.1); color: var(--milonga); }
  .genre-tag.Vals    { background: rgba(74,222,128,0.1); color: var(--vals); }
</style>
