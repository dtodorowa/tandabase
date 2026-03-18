<script lang="ts">
  import { getPublicSets } from '$lib/firebase/db';
  import type { PracticaSet } from '$lib/types';

  let sets = $state<PracticaSet[]>([]);
  let loading = $state(true);
  let filter = $state('All');

  const filters = ['All', 'Tango', 'Milonga', 'Vals', 'Mixed'];

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

  const coverImages = [
    'https://images.unsplash.com/photo-1619983081563-430f63602796?q=80&w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?q=80&w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1507838153414-b4b713384a76?q=80&w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?q=80&w=800&auto=format&fit=crop',
  ];

  function getCover(set: PracticaSet, index: number): string {
    return set.cover_image || coverImages[index % coverImages.length];
  }
</script>

<svelte:head>
  <title>Browse Sets - Tandabase</title>
</svelte:head>

<div class="pt-28 md:pt-36 pb-16 bg-surface dark:bg-background text-ink min-h-screen">
  <div class="max-w-[1600px] mx-auto w-full">

    <!-- Header + filter pills -->
    <div class="px-6 md:px-16 mb-12 flex flex-col md:flex-row md:justify-between md:items-end gap-6">
      <div>
        <h2 class="font-serif text-5xl md:text-6xl tracking-tight text-ink mb-4">Community Sets</h2>
        <p class="text-ink-muted font-light text-lg">Curated collections from dancers worldwide. Swipe to explore.</p>
      </div>

      <div class="flex gap-2 pb-2">
        {#each filters as f}
          <button
            onclick={() => filter = f}
            class="px-6 py-2 rounded-full text-xs font-medium uppercase tracking-widest transition-colors cursor-pointer border-none font-sans
              {filter === f
                ? 'bg-ink text-primary-foreground'
                : 'bg-black/5 dark:bg-white/5 text-ink-muted hover:bg-black/10 dark:hover:bg-white/10 hover:text-ink'}"
          >
            {f}
          </button>
        {/each}
      </div>
    </div>

    <!-- Horizontal card scroll -->
    <div class="flex overflow-x-auto snap-x snap-mandatory no-scrollbar px-6 md:px-16 gap-8 pb-32 items-center min-h-[500px]">
      {#if loading}
        {#each [0, 1, 2] as i}
          <div class="snap-center shrink-0 w-[85vw] md:w-[450px] aspect-square rounded-md bg-black/5 dark:bg-white/5 animate-pulse"></div>
        {/each}
      {:else if filteredSets.length === 0}
        <div class="flex items-center justify-center w-full py-20">
          <p class="font-mono text-sm text-ink-muted uppercase tracking-widest">No sets found</p>
        </div>
      {:else}
        {#each filteredSets as set, i (set.id)}
          <a href="/set/{set.id}" class="snap-center shrink-0 w-[85vw] md:w-[450px] aspect-square relative group cursor-pointer no-underline">
            <div class="absolute -inset-6 bg-black/5 dark:bg-white/5 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
            <div class="w-full h-full rounded-md overflow-hidden relative z-10 shadow-[0_10px_30px_rgba(0,0,0,0.08)] transition-transform duration-700 ease-spring group-hover:-translate-y-4 border border-black/5 dark:border-white/5">
              <img src={getCover(set, i)} class="w-full h-full object-cover grayscale opacity-90 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-700" alt={set.title}>
              <!-- Hover overlay -->
              <div class="absolute inset-0 bg-linear-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 p-8 flex flex-col justify-end">
                <span class="text-white/70 text-xs tracking-widest uppercase mb-3">{set.tanda_count} Tandas &bull; {set.song_count} Songs</span>
                <h3 class="font-serif text-4xl text-white leading-tight">{set.title}</h3>
              </div>
            </div>
            <!-- Caption below card -->
            <div class="mt-8 text-center group-hover:opacity-0 transition-opacity duration-500">
              <h3 class="font-serif text-2xl text-ink">{set.title}</h3>
              <p class="text-ink-muted text-sm mt-2 font-light">Curated by {set.authorName}</p>
            </div>
          </a>
        {/each}
      {/if}

      <!-- Spacer -->
      <div class="snap-center shrink-0 w-[5vw] md:w-[10vw]"></div>
    </div>
  </div>
</div>
