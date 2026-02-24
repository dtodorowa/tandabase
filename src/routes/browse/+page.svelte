<script lang="ts">
  import { getPublicSets } from '$lib/firebase/db';
  import type { PracticaSet } from '$lib/types';
  import SetGrid from '$lib/components/browse/SetGrid.svelte';
  import FilterBar from '$lib/components/browse/FilterBar.svelte';

  let sets = $state<PracticaSet[]>([]);
  let loading = $state(true);
  let filter = $state('All');

  const filteredSets = $derived(
    filter === 'All'
      ? sets
      : filter === 'Mixed'
        ? sets.filter(s => s.genre_summary.length > 1)
        : sets.filter(s => s.genre_summary.includes(filter as any))
  );

  $effect(() => {
    loadSets();
  });

  async function loadSets() {
    loading = true;
    try {
      sets = await getPublicSets();
    } catch (e) {
      console.error('Failed to load sets:', e);
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>Browse Sets - Practica Set</title>
</svelte:head>

<div class="browse-page">
  <div class="browse-header">
    <h1>Community Sets</h1>
    <p>Browse sets shared by other tango dancers and DJs</p>
  </div>

  <FilterBar selected={filter} onchange={(f) => filter = f} />

  {#if loading}
    <div class="loading">Loading sets...</div>
  {:else}
    <SetGrid sets={filteredSets} />
  {/if}
</div>

<style>
  .browse-page {
    max-width: 1100px;
    margin: 0 auto;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }
  .browse-header h1 {
    font-family: 'Space Grotesk', sans-serif;
    font-size: var(--fs-heading);
    font-weight: 700;
    letter-spacing: -0.02em;
  }
  .browse-header p {
    font-size: var(--fs-xs);
    color: var(--text-dim);
    margin-top: 0.2rem;
  }
  .loading {
    text-align: center;
    padding: 3rem;
    color: var(--text-dim);
    font-size: var(--fs-sm);
  }
</style>
