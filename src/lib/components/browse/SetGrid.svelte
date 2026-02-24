<script lang="ts">
  import type { PracticaSet } from '$lib/types';
  import SetCard from './SetCard.svelte';

  let { sets }: { sets: PracticaSet[] } = $props();
</script>

{#if sets.length === 0}
  <div class="empty">
    <p>No sets found</p>
  </div>
{:else}
  <div class="set-grid">
    {#each sets as set (set.id)}
      <SetCard {set} />
    {/each}
  </div>
{/if}

<style>
  .set-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1rem;
  }
  .empty {
    text-align: center;
    padding: 3rem;
    color: var(--text-dim);
    font-size: var(--fs-sm);
  }
</style>
