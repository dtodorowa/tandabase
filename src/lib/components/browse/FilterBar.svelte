<script lang="ts">
  import type { Genre } from '$lib/types';

  let { selected = 'All', onchange }: { selected?: string; onchange: (filter: string) => void } = $props();

  const filters = ['All', 'Tango', 'Milonga', 'Vals', 'Mixed'];
</script>

<div class="filter-bar">
  {#each filters as f}
    <button
      class="filter-btn"
      class:active={selected === f}
      onclick={() => onchange(f)}
    >
      {f}
    </button>
  {/each}
</div>

<style>
  .filter-bar {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
  }
  .filter-btn {
    background: var(--surface2);
    border: 1px solid var(--border);
    color: var(--text-mid);
    padding: 0.35rem 0.75rem;
    font-size: var(--fs-2xs);
    font-weight: 500;
    border-radius: 99px;
    transition: all 0.15s;
    cursor: pointer;
    font-family: 'Outfit', sans-serif;
  }
  .filter-btn:hover {
    border-color: var(--accent);
    color: var(--accent);
  }
  .filter-btn.active {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--bg);
  }
</style>
