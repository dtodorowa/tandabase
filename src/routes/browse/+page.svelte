<script lang="ts">
  import { getPublicSets } from '$lib/firebase/db';
  import type { PracticaSet } from '$lib/types';
  import { Search } from 'lucide-svelte';

  let sets = $state<PracticaSet[]>([]);
  let loading = $state(true);
  let filter = $state('All');
  let searchQuery = $state('');

  const filters = ['All', 'Tango', 'Milonga', 'Vals', 'Mixed'];

  const filteredSets = $derived.by(() => {
    let result = sets;

    // Genre filter
    if (filter !== 'All') {
      if (filter === 'Mixed') {
        result = result.filter(s => s.genre_summary.length > 1);
      } else {
        result = result.filter(s => s.genre_summary.includes(filter as any));
      }
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s =>
        s.title.toLowerCase().includes(q) ||
        s.authorName?.toLowerCase().includes(q) ||
        s.description?.toLowerCase().includes(q) ||
        s.tandas.some(t => t.orchestra.toLowerCase().includes(q))
      );
    }

    return result;
  });

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
  <div class="max-w-7xl mx-auto w-full px-6 md:px-16">

    <!-- Header -->
    <div class="mb-10">
      <div class="font-mono text-xs text-ink-muted mb-4 uppercase tracking-widest">&gt; Archive</div>
      <h1 class="font-serif text-5xl md:text-6xl font-bold tracking-tight text-ink leading-tight">Community Sets</h1>
      <p class="text-lg text-ink-muted font-light mt-2">Curated collections from dancers worldwide.</p>
    </div>

    <!-- Search + Filter bar -->
    <div class="flex flex-col sm:flex-row gap-3 mb-8 border-b border-black/5 dark:border-white/5 pb-8">
      <div class="relative flex-1">
        <Search class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
        <input
          type="text"
          placeholder="Search by title, orchestra, or author..."
          bind:value={searchQuery}
          class="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-card border border-black/5 dark:border-white/5 rounded-xl text-sm text-ink outline-none focus:border-ink dark:focus:border-white transition-colors font-sans"
        />
      </div>
      <div class="flex gap-1.5 flex-wrap">
        {#each filters as f}
          <button
            onclick={() => filter = f}
            class="px-4 py-2 rounded-xl text-xs font-medium uppercase tracking-widest transition-colors cursor-pointer border font-sans
              {filter === f
                ? 'bg-ink dark:bg-white text-white dark:text-ink border-ink dark:border-white'
                : 'bg-white dark:bg-card text-ink-muted border-black/5 dark:border-white/5 hover:border-ink/30 dark:hover:border-white/30 hover:text-ink'}"
          >
            {f}
          </button>
        {/each}
      </div>
    </div>

    <!-- Results count -->
    {#if !loading}
      <p class="text-xs text-ink-faint font-mono mb-6">
        {filteredSets.length} set{filteredSets.length !== 1 ? 's' : ''}{searchQuery.trim() || filter !== 'All' ? ' matching' : ' total'}
      </p>
    {/if}

    <!-- Grid -->
    {#if loading}
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {#each [0, 1, 2, 3, 4, 5, 6, 7] as i}
          <div class="aspect-4/3 rounded-2xl bg-black/5 dark:bg-white/5 animate-pulse"></div>
        {/each}
      </div>
    {:else if filteredSets.length === 0}
      <div class="flex flex-col items-center justify-center py-24 text-center">
        <p class="font-mono text-sm text-ink-muted uppercase tracking-widest mb-2">No sets found</p>
        {#if searchQuery.trim() || filter !== 'All'}
          <p class="text-xs text-ink-faint">Try a different search or filter.</p>
        {/if}
      </div>
    {:else}
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {#each filteredSets as set, i (set.id)}
          <a href="/set/{set.id}" class="group rounded-2xl overflow-hidden border border-black/5 dark:border-white/5 bg-card hover:shadow-lg hover:border-black/15 dark:hover:border-white/15 transition-all duration-300 no-underline block">
            <div class="aspect-4/3 overflow-hidden relative">
              <img
                src={getCover(set, i)}
                class="w-full h-full object-cover grayscale opacity-90 group-hover:grayscale-0 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
                alt={set.title}
              />
              <div class="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent"></div>
              <div class="absolute bottom-3 left-3 right-3">
                <h3 class="font-serif text-lg text-white leading-snug truncate">{set.title}</h3>
                <p class="text-white/60 text-[11px] mt-0.5">{set.tanda_count} tandas · {set.song_count} songs</p>
              </div>
            </div>
            <div class="px-3.5 py-2.5 flex items-center justify-between">
              <span class="text-[11px] text-ink-muted font-light truncate">By {set.authorName}</span>
              <div class="flex gap-1 shrink-0">
                {#each set.genre_summary.slice(0, 2) as genre}
                  <span class="text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-widest bg-black/5 dark:bg-white/5 text-ink-muted">{genre}</span>
                {/each}
              </div>
            </div>
          </a>
        {/each}
      </div>
    {/if}
  </div>
</div>
