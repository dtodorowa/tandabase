<script lang="ts">
  import { authState } from '$lib/stores/auth.svelte';
  import { getPublicSets } from '$lib/firebase/db';
  import { playerModal } from '$lib/stores/playerModal.svelte';
  import type { PracticaSet } from '$lib/types';
  import { Check, Upload, Play } from 'lucide-svelte';
  import VinylCarousel from '$lib/components/shared/VinylCarousel.svelte';

  import featuredSetsJson from '$lib/data/featured-sets.json';

  // Featured sets load instantly from static JSON (no network)
  const featuredSets: PracticaSet[] = featuredSetsJson as PracticaSet[];

  // Community sets still come from Firebase
  let communitySets = $state<PracticaSet[]>([]);
  let communityLoading = $state(true);
  let randomSet = $state<PracticaSet | null>(null);

  const coverImages = [
    'album-covers/di-sarli.jpg',
    'album-covers/pugliese.jpg',
    'album-covers/troilo.jpg',
  ];

  function getCover(set: PracticaSet, index: number): string {
    return set.cover_image || coverImages[index % coverImages.length];
  }

  $effect(() => {
    loadCommunitySets();
  });

  async function loadCommunitySets() {
    communityLoading = true;
    try {
      communitySets = await getPublicSets(10);
      if (communitySets.length > 0) {
        randomSet = communitySets[Math.floor(Math.random() * communitySets.length)];
      }
    } catch (e) {
      console.error('Failed to load community sets:', e);
    } finally {
      communityLoading = false;
    }
  }
</script>

<svelte:head>
  <title>tandabase | Digital Tanda Archive</title>
</svelte:head>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->

<main
  class="pt-8 sm:pt-0 grow bg-surface dark:bg-background text-ink selection:bg-ink selection:text-white dark:selection:bg-white dark:selection:text-black"
>

  <!-- ═══ Hero / Vinyl Carousel ═══ -->
  <VinylCarousel sets={featuredSets} displayCount={12} />

     <!-- <div class="flex gap-4 flex-wrap justify-center">
      <a href="/browse" class="group relative inline-flex items-center justify-center px-10 py-4 text-sm font-medium tracking-wide text-primary-foreground bg-primary rounded-full overflow-hidden transition-transform active:scale-95 shadow-xl shadow-black/10 hover:shadow-2xl hover:shadow-black/20 duration-300 no-underline">
        <span class="relative">Browse Community Sets</span>
      </a>

      <a href="/create" class="inline-flex items-center justify-center px-10 py-4 text-sm font-medium tracking-wide text-ink border border-black/10 dark:border-white/10 rounded-full transition-all hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 no-underline">
        Create Your Own Set
      </a>
    </div> -->

  <!-- ═══ Not a DJ tool ═══ -->
  <section class="w-full bg-ink text-surface py-32 px-6 text-center my-32">
    <h2 class="font-serif text-5xl md:text-7xl tracking-tighter mb-8 text-surface">
      Btw: this is <span class="italic text-surface/50">NOT</span> a DJing app
    </h2>
    <p class="font-light text-xl text-surface/70 max-w-2xl mx-auto leading-relaxed">
      It's a learning tool. <br><br>
      If you want to DJ a milonga, buy the music and support the people who are working hard to preserve tango recordings.
    </p>
  </section>

  <!-- ═══ Community Sets Carousel ═══ -->
  <section class="w-full mb-32">
    <div class="px-6 md:px-16 mb-12 flex flex-col md:flex-row md:justify-between md:items-end gap-6 max-w-[1600px] mx-auto">
      <div>
        <div class="text-xs text-ink-muted mb-4 uppercase tracking-widest">Community Sets</div>
        <h2 class="font-serif text-4xl md:text-5xl tracking-tight text-ink mb-2">Browse the archive.</h2>
        <p class="text-ink-muted font-light text-lg">Sets shared by other tango dancers and DJs.</p>
      </div>
      <a href="/browse" class="text-xs uppercase tracking-widest font-medium text-ink border-b border-ink pb-1 hover:text-ink-muted transition-colors no-underline">View All →</a>
    </div>

    <div class="flex overflow-x-auto snap-x snap-mandatory no-scrollbar px-6 md:px-16 gap-8 pb-16 items-center">
      {#if communityLoading && communitySets.length === 0}
        {#each [0, 1, 2] as i}
          <div class="snap-center shrink-0 w-[85vw] md:w-[450px] aspect-square rounded-xl bg-black/5 dark:bg-white/5 animate-pulse"></div>
        {/each}
      {:else}
        {#each communitySets.slice(0, 7) as set, i (set.id)}
          <div
            onclick={() => playerModal.openModal(set)}
            class="snap-center shrink-0 w-[85vw] md:w-[450px] aspect-square relative group cursor-pointer"
          >
            <div class="absolute -inset-6 bg-black/5 dark:bg-white/5 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
            <div class="w-full h-full rounded-xl overflow-hidden relative z-10 shadow-[0_10px_30px_rgba(0,0,0,0.05)] transition-transform duration-700 ease-[var(--ease-spring,cubic-bezier(0.37,0,0.63,1))] group-hover:-translate-y-4 border border-black/5 dark:border-white/5 bg-card">
              <img
                src={getCover(set, i)}
                class="w-full h-[65%] object-cover grayscale opacity-90 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-700 select-none pointer-events-none"
                alt={set.title}
                draggable="false"
              >
              <div class="p-6 h-[35%] flex flex-col justify-between bg-card">
                <h3 class="font-serif text-2xl text-ink">{set.title}</h3>
                <div class="flex justify-between items-center text-xs font-medium text-ink-muted tracking-wide">
                  <span>By {set.authorName}</span>
                  <span>{set.tanda_count} tandas &bull; {set.song_count} songs</span>
                </div>
              </div>
            </div>
          </div>
        {/each}

        {#if communitySets.length === 0}
          <div class="snap-center shrink-0 w-[85vw] md:w-[450px] aspect-square rounded-xl border border-dashed border-black/20 dark:border-white/20 flex items-center justify-center">
            <p class="font-mono text-sm text-ink-muted uppercase tracking-widest">No sets yet</p>
          </div>
        {/if}
      {/if}
      <div class="snap-center shrink-0 w-[5vw] md:w-[10vw]"></div>
    </div>
  </section>


  <!-- ═══ Footer ═══ -->
  <footer class="bg-card border-t border-black/5 dark:border-white/5 pt-20 pb-10 px-6 md:px-16 mt-auto">
    <div class="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-16 mb-20">

      <div class="lg:col-span-1">
        <a href="/" class="font-serif text-3xl italic tracking-tight text-ink block mb-6 no-underline">tandabase.</a>
        <p class="text-ink-muted font-light leading-relaxed max-w-sm mb-8">
          An ad-less, open-source player for tango nerds to build, share, and study tandas.
        </p>
      </div>

      <div>
        <h3 class="font-mono text-xs text-ink uppercase tracking-widest mb-6">/* Actively Building */</h3>
        <ul class="space-y-4 text-sm font-light text-ink-muted list-none p-0">
          <li class="flex items-center gap-3 text-ink/40 line-through">
            <Check class="w-4 h-4" /> Desktop editor redesign
          </li>
          <li class="flex items-center gap-3">
            <div class="w-4 h-4 border border-black/20 dark:border-white/20 rounded-sm"></div>
            Mobile screens review
          </li>
          <li class="flex items-center gap-3">
            <div class="w-4 h-4 border border-black/20 dark:border-white/20 rounded-sm"></div>
            Drag-and-drop improvements
          </li>
          <li class="flex items-center gap-3">
            <div class="w-4 h-4 border border-black/20 dark:border-white/20 rounded-sm"></div>
            Better search & filtering
          </li>
        </ul>
      </div>

      <!-- <div>
        <h3 class="font-mono text-xs text-ink uppercase tracking-widest mb-6">Contribute</h3>
        <ul class="space-y-4 text-sm font-light text-ink-muted flex flex-col items-start list-none p-0">
          <button class="hover:text-ink transition-colors cursor-pointer bg-transparent border-none font-sans text-sm font-light text-ink-muted">GitHub Repository</button>
          <button class="hover:text-ink transition-colors cursor-pointer bg-transparent border-none font-sans text-sm font-light text-ink-muted">Report an Issue</button>
          <button class="hover:text-ink transition-colors cursor-pointer bg-transparent border-none font-sans text-sm font-light text-ink-muted">Feature Requests</button>
        </ul>
      </div> -->
    </div>

    <div class="max-w-7xl mx-auto border-t border-black/5 dark:border-white/5 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
      <p class="text-xs text-ink-faint font-light">&copy; 2026 Tandabase. All rights reserved.</p>
      <p class="text-[10px] uppercase tracking-[0.2em] font-medium text-ink-muted">Made with &#127851; by Dandan</p>
    </div>
  </footer>
</main>
