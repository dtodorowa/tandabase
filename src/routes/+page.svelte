<script lang="ts">
  import { authState } from '$lib/stores/auth.svelte';
  import { getPublicSets } from '$lib/firebase/db';
  import { playerModal } from '$lib/stores/playerModal.svelte';
  import type { PracticaSet } from '$lib/types';
  import { Check, Upload, Play } from 'lucide-svelte';
  import { onMount } from 'svelte';

  let sets = $state<PracticaSet[]>([]);
  let loading = $state(true);
  let randomSet = $state<PracticaSet | null>(null);
  let launchingAlbumId = $state<string | null>(null);
  let mounted = $state(false);
  let entranceDone = $state(false);

  // svelte-ignore non_reactive_update
  let scrollContainer: HTMLDivElement;
  let isResetting = false;

  // Auto-scroll state
  let autoScrollPaused = false;
  let autoScrollRAF: number;
  const autoScrollSpeed = 0.3;

  const DISPLAY_COUNT = 6;

  let carouselItems = $derived.by(() => {
    const displaySets = sets.slice(0, DISPLAY_COUNT);
    if (displaySets.length === 0) return [];
    return [...displaySets, ...displaySets, ...displaySets];
  });

  $effect(() => {
    loadSets();
  });

  async function loadSets() {
    loading = true;
    try {
      sets = await getPublicSets(10);
      if (sets.length > 0) {
        randomSet = sets[Math.floor(Math.random() * sets.length)];
      }
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

  function getAlbumId(set: PracticaSet): string {
    return set.id ?? set.title;
  }

  // ── Portal launch ──
  // Clones the record element into a fixed div appended to <body>,
  // completely escaping every stacking context (including the navbar).
  function launchRecord(albumEl: HTMLElement, set: PracticaSet) {
    const recordEl = albumEl.querySelector('.record') as HTMLElement | null;
    if (!recordEl) return;

    const rect = recordEl.getBoundingClientRect();

    // Build portal wrapper at exact screen position
    const portal = document.createElement('div');
    portal.style.cssText = `
      position: fixed;
      top: ${rect.top}px;
      left: ${rect.left}px;
      width: ${rect.width}px;
      height: ${rect.height}px;
      z-index: 99999;
      pointer-events: none;
      overflow: visible;
    `;

    // Clone the record's inner HTML so the disc + grooves + label are all there
    const clone = recordEl.cloneNode(true) as HTMLElement;
    // Make sure the clone starts with the disc already spinning
    clone.querySelector('.disc')?.classList.add('animate-spin-launch');
    clone.style.cssText = `
      width: 100%;
      height: 100%;
      opacity: 1;
      transform: scale(1);
    `;
    portal.appendChild(clone);
    document.body.appendChild(portal);

    // Flush layout so the browser registers the start state before transitioning
    portal.getBoundingClientRect();

    // Animate: fly up and scale enormous, fade out near the top
    portal.style.transition = 'transform 2s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease 0.45s';
    portal.style.transform = 'translateY(-85vh) scale(2.9)';
    portal.style.opacity = '0';

    // Open modal then clean up
    setTimeout(() => {
      playerModal.openModal(set);
      portal.remove();
      launchingAlbumId = null;
    }, 400);
  }

  function handleAlbumClick(e: MouseEvent, set: PracticaSet) {
    e.stopPropagation();
    const id = getAlbumId(set);
    if (launchingAlbumId === id) return;

    launchingAlbumId = id;

    const albumEl = (e.currentTarget as HTMLElement).closest('.album') as HTMLElement;
    launchRecord(albumEl, set);
  }

  // ── Infinite loop boundary check ──
  function handleScroll() {
    if (!scrollContainer || isResetting) return;
    const displaySets = sets.slice(0, DISPLAY_COUNT);
    if (displaySets.length === 0) return;

    const itemWidth = 296;
    const singleSetWidth = displaySets.length * itemWidth;
    const scrollLeft = scrollContainer.scrollLeft;

    if (scrollLeft < singleSetWidth * 0.25) {
      isResetting = true;
      scrollContainer.scrollLeft = scrollLeft + singleSetWidth;
      requestAnimationFrame(() => { isResetting = false; });
    } else if (scrollLeft > singleSetWidth * 2.25) {
      isResetting = true;
      scrollContainer.scrollLeft = scrollLeft - singleSetWidth;
      requestAnimationFrame(() => { isResetting = false; });
    }
  }

  // ── Auto-scroll RAF loop ──
  function tickAutoScroll() {
    if (scrollContainer && !autoScrollPaused && !isResetting) {
      scrollContainer.scrollLeft += autoScrollSpeed;
      handleScroll();
    }
    autoScrollRAF = requestAnimationFrame(tickAutoScroll);
  }

  function pauseAutoScroll() { autoScrollPaused = true; }
  function resumeAutoScroll() { autoScrollPaused = false; }

  onMount(() => {
    mounted = true;
    setTimeout(() => { entranceDone = true; }, 1200);
    autoScrollRAF = requestAnimationFrame(tickAutoScroll);
    return () => cancelAnimationFrame(autoScrollRAF);
  });

  // Set initial scroll to the middle copy once sets load
  $effect(() => {
    if (sets.length > 0 && scrollContainer) {
      requestAnimationFrame(() => {
        const displaySets = sets.slice(0, DISPLAY_COUNT);
        scrollContainer.scrollLeft = displaySets.length * 296;
      });
    }
  });
</script>

<svelte:head>
  <title>tandabase | Digital Tanda Archive</title>
</svelte:head>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<main
  class="grow bg-surface dark:bg-background text-ink selection:bg-ink selection:text-white dark:selection:bg-white dark:selection:text-black"
>

  <!-- ═══ Hero / Vinyl Carousel ═══ -->
  <section class="w-full min-h-[80vh] flex flex-col items-center justify-center relative text-center">
    <div class="relative w-full z-2">

      {#if loading && sets.length === 0}
        <div class="flex gap-8 overflow-x-hidden px-16 pt-40 pb-10 items-end">
          {#each Array(5) as _, i}
            <div
              class="w-[260px] min-w-[260px] h-[260px] relative flex items-end justify-center cursor-pointer animate-skeleton-float"
              style="animation-delay: {i * 0.12}s"
            >
              <div class="w-[260px] h-[260px] rounded-md bg-black/6 dark:bg-white/6 relative z-3 overflow-hidden shadow-[0_12px_40px_rgba(0,0,0,0.18)]">
                <div class="absolute inset-0 bg-linear-to-r from-transparent via-white/8 to-transparent animate-skeleton-shimmer"></div>
              </div>
            </div>
          {/each}
        </div>

      {:else if carouselItems.length > 0}
        <div
          class="carousel-row flex gap-8 no-scrollbar px-16 pb-10 items-end"
          style="padding-top: 200px; scroll-behavior: auto;"
          bind:this={scrollContainer}
          onscroll={handleScroll}
          onmouseenter={pauseAutoScroll}
          onmouseleave={resumeAutoScroll}
        >
          {#each carouselItems as set, i}
            {@const realIndex = i % sets.slice(0, DISPLAY_COUNT).length}
            {@const id = getAlbumId(set)}
            {@const isLaunching = launchingAlbumId === id}

            <div
              class="album {mounted && !entranceDone ? 'animate-album-entrance' : ''}"
              class:is-launching={isLaunching}
              style="--entrance-delay: {realIndex * 0.08}s"
              onclick={(e) => handleAlbumClick(e, set)}
            >
              <!-- ── Sleeve ── -->
              <div class="sleeve">
                <img
                  src={getCover(set, realIndex)}
                  alt={set.title}
                  loading="lazy"
                  draggable="false"
                  class="w-full h-full object-cover block transition-[filter] duration-500 grayscale-[0.3] select-none pointer-events-none"
                />
                <div class="absolute bottom-0 left-0 right-0 px-3.5 pt-8 pb-3 bg-linear-to-t from-black/75 to-transparent flex flex-col gap-0.5 pointer-events-none select-none">
                  <span class="font-serif text-[15px] font-medium text-white truncate leading-snug">{set.title}</span>
                  <span class="text-[11px] text-white/60 tracking-[0.06em] uppercase">{set.authorName}</span>
                </div>
              </div>

              <!-- record-portal: sits above sleeve, overflow visible -->
              <div class="record-portal">
                <div class="record" class:launching-hide={isLaunching}>
                  <div class="disc animate-spin-hover">
                    <div class="disc-grooves"></div>
                    <div class="disc-label">
                      <div class="disc-hole"></div>
                  </div>
                  </div>
                </div>
              </div>

            </div>
          {/each}
        </div>
      {/if}

     
    </div>
  </section>

  <!-- ═══ Not a DJ tool ═══ -->
  <section class="w-full bg-ink-muted text-surface py-32 px-6 text-center my-32">
    <h2 class="font-serif text-5xl md:text-7xl tracking-tighter mb-8 text-surface">
      This is <span class="italic text-surface/50">NOT</span> a DJing app
    </h2>
    <p class="font-light text-xl text-surface/70 max-w-2xl mx-auto leading-relaxed">
      It's a learning tool. There is no autoplay or cortina gaps (on purpose). Just YouTube embeds for studying.<br><br>
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
      {#if loading && sets.length === 0}
        {#each [0, 1, 2] as i}
          <div class="snap-center shrink-0 w-[85vw] md:w-[450px] aspect-square rounded-xl bg-black/5 dark:bg-white/5 animate-pulse"></div>
        {/each}
      {:else}
        {#each sets.slice(0, 7) as set, i (set.id)}
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

        {#if sets.length === 0}
          <div class="snap-center shrink-0 w-[85vw] md:w-[450px] aspect-square rounded-xl border border-dashed border-black/20 dark:border-white/20 flex items-center justify-center">
            <p class="font-mono text-sm text-ink-muted uppercase tracking-widest">No sets yet</p>
          </div>
        {/if}
      {/if}
      <div class="snap-center shrink-0 w-[5vw] md:w-[10vw]"></div>
    </div>
  </section>




  <!-- ═══ Tanda Roulette ═══ -->
  <section class="w-full max-w-6xl mx-auto px-6 md:px-16 mb-32 flex flex-col items-center">
    <div class="text-center mb-16">
      <div class="font-mono text-xs text-ink-muted mb-4 uppercase tracking-widest">&gt; Tanda_Roulette</div>
      <h2 class="font-serif text-5xl md:text-6xl tracking-tight text-ink mb-4">Take it for a spin.</h2>
      <p class="font-sans text-xl text-ink-muted font-light">Drop the needle on a random set and see how the player works.</p>
    </div>

    {#if randomSet}
      <div class="w-full max-w-3xl bg-card rounded-3xl border border-black/10 dark:border-white/10 shadow-[0_30px_60px_rgba(0,0,0,0.08)] overflow-hidden">
        <div class="p-8 md:p-12 flex flex-col sm:flex-row gap-10 items-center">
          <div class="w-48 h-48 rounded-full bg-ink flex items-center justify-center shrink-0 relative shadow-2xl">
            <div class="absolute inset-2 border border-white/20 rounded-full"></div>
            <div class="absolute inset-6 border border-white/20 rounded-full"></div>
            <div class="absolute inset-10 border border-white/20 rounded-full"></div>
            <div class="w-16 h-16 bg-surface rounded-full flex items-center justify-center z-10 border border-black/10 dark:border-white/10">
              <div class="w-2 h-2 bg-ink rounded-full"></div>
            </div>
          </div>

          <div class="w-full">
            <span class="text-[10px] font-medium px-3 py-1 rounded-full bg-surface border border-black/5 dark:border-white/5 text-ink-muted mb-4 inline-block tracking-[0.2em] uppercase">
              Curated by @{randomSet.authorName}
            </span>
            <h3 class="font-serif text-3xl text-ink mb-2">{randomSet.title}</h3>
            <p class="text-ink-muted text-sm font-light mb-8">{randomSet.tanda_count} tandas &bull; {randomSet.song_count} songs</p>
            <button
              onclick={() => playerModal.openModal(randomSet!)}
              class="w-full sm:w-auto px-8 py-3 bg-ink text-primary-foreground rounded-full text-sm font-medium tracking-wide hover:opacity-80 transition-colors inline-flex items-center justify-center gap-2 shadow-lg cursor-pointer border-none font-sans"
            >
              <Play class="w-4 h-4" fill="currentColor" />
              Launch Player
            </button>
          </div>
        </div>
      </div>
    {:else if !loading}
      <div class="w-full max-w-3xl bg-card rounded-3xl border border-dashed border-black/15 dark:border-white/15 p-12 flex items-center justify-center">
        <p class="font-mono text-sm text-ink-muted uppercase tracking-widest">No sets available yet</p>
      </div>
    {/if}
  </section>


  <!-- ═══ Footer ═══ -->
  <footer class="bg-card border-t border-black/5 dark:border-white/5 pt-20 pb-10 px-6 md:px-16 mt-auto">
    <div class="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-16 mb-20">

      <div class="lg:col-span-1">
        <a href="/" class="font-serif text-3xl italic tracking-tight text-ink block mb-6 no-underline">tandabase.</a>
        <p class="text-ink-muted font-light leading-relaxed max-w-sm mb-8">
          An ad-less, open-source player for tango nerds to build, share, and study tandas.
        </p>
        <div class="font-mono text-xs text-ink/40 uppercase tracking-widest">&gt; System_Status: Online</div>
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

      <div>
        <h3 class="font-mono text-xs text-ink uppercase tracking-widest mb-6">Contribute</h3>
        <ul class="space-y-4 text-sm font-light text-ink-muted flex flex-col items-start list-none p-0">
          <button class="hover:text-ink transition-colors cursor-pointer bg-transparent border-none font-sans text-sm font-light text-ink-muted">GitHub Repository</button>
          <button class="hover:text-ink transition-colors cursor-pointer bg-transparent border-none font-sans text-sm font-light text-ink-muted">Report an Issue</button>
          <button class="hover:text-ink transition-colors cursor-pointer bg-transparent border-none font-sans text-sm font-light text-ink-muted">Feature Requests</button>
        </ul>
      </div>
    </div>

    <div class="max-w-7xl mx-auto border-t border-black/5 dark:border-white/5 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
      <p class="text-xs text-ink-faint font-light">&copy; 2026 Tandabase. All rights reserved.</p>
      <p class="text-[10px] uppercase tracking-[0.2em] font-medium text-ink-muted">Made with &#127851; by Daniela</p>
    </div>
  </footer>
</main>

<style>
  .carousel-row {
    overflow-x: auto;
    overflow-y: visible;
  }

  /* ── Album shell ── */
  .album {
    width: 260px;
    min-width: 260px;
    height: 260px;
    position: relative;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    cursor: pointer;
    transition: transform 0.3s cubic-bezier(0.2, 0.9, 0.2, 1);
    overflow: visible;
  }
  .album:hover {
    transform: translateY(-4px);
  }

  /* ── Sleeve ── */
  .sleeve {
    width: 260px;
    height: 260px;
    background: var(--card, #eee);
    border-radius: 6px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
    overflow: hidden;
    position: relative;
    z-index: 3;
    transform: translateY(0) rotate(0deg);
    transition:
      transform 0.35s cubic-bezier(0.2, 0.9, 0.2, 1),
      box-shadow 0.35s cubic-bezier(0.2, 0.9, 0.2, 1);
  }
  .album:not(.is-launching):hover .sleeve {
    transform: translateY(-24px);
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25);
  }
  .album:not(.is-launching):hover .sleeve img {
    filter: grayscale(0);
  }
  /* On launch, sleeve tilts as if the record ripped out */
  .album.is-launching .sleeve {
    transform: translateY(-28px) rotate(-7deg) scale(0.97) !important;
    box-shadow: 0 28px 55px rgba(0, 0, 0, 0.22);
    transition:
      transform 0.55s cubic-bezier(0.16, 1, 0.3, 1),
      box-shadow 0.55s cubic-bezier(0.16, 1, 0.3, 1);
  }

  /* ── Record portal ── */
  .record-portal {
    position: absolute;
    left: 50%;
    top: 0;
    width: 220px;
    height: 220px;
    margin-left: -110px;
    overflow: visible;
    z-index: 1;
    pointer-events: none;
  }

  /* ── Vinyl record ── */
  .record {
    width: 220px;
    height: 220px;
    transform: translateY(0) scale(0.7);
    opacity: 0;
    transition:
      transform 0.38s cubic-bezier(0.2, 0.9, 0.2, 1),
      opacity 0.3s ease;
  }
  /* Peek on hover */
  .album:not(.is-launching):hover .record {
    opacity: 1;
    transform: translateY(-61%) scale(1);
  }
  /*
    When launching, hide the in-DOM record immediately —
    the portal clone takes over and flies above everything.
  */
  .record.launching-hide {
    opacity: 0 !important;
    transform: translateY(0) scale(0.7) !important;
    transition: none !important;
  }

  /* ── Disc ── */
  .disc {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background-color: #181818;
    box-shadow:
      0 0 0 1px rgba(255, 255, 255, 0.04),
      0 6px 30px rgba(0, 0, 0, 0.4);
    position: relative;
    overflow: hidden;
  }

  /* Grooves */
  .disc-grooves {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: radial-gradient(circle at center,
      transparent 18%,
      rgba(40,40,40,0.9) 18.5%, rgba(30,30,30,1) 22%,
      rgba(50,50,50,0.7) 24%, rgba(25,25,25,1) 26%,
      rgba(45,45,45,0.8) 28%, rgba(20,20,20,1) 30%,
      rgba(50,50,50,0.6) 33%, rgba(25,25,25,1) 36%,
      rgba(40,40,40,0.8) 39%, rgba(20,20,20,1) 42%,
      rgba(55,55,55,0.6) 45%, rgba(22,22,22,1) 48%,
      rgba(18,18,18,1) 50%
    );
  }
  .disc-grooves::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: conic-gradient(from 0deg,
      transparent 0deg, rgba(255,255,255,0.06) 40deg,
      rgba(255,255,255,0.12) 55deg, transparent 80deg,
      transparent 180deg, rgba(255,255,255,0.04) 220deg,
      rgba(255,255,255,0.08) 235deg, transparent 260deg,
      transparent 360deg
    );
    animation: shimmer 3s ease-in-out infinite;
    pointer-events: none;
  }

  /* Red centre label */
  .disc-label {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 62px;
    height: 62px;
    border-radius: 50%;
    background: radial-gradient(circle, #c0392b, #8e2420);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 2;
    box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.3);
  }
  .disc-hole {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #111;
    z-index: 3;
  }

  /* ════ Keyframes ════ */

  @keyframes spin-vinyl {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }

  .animate-spin-hover {
    animation: spin-vinyl 4s linear infinite;
    animation-play-state: paused;
  }
  .album:hover .animate-spin-hover {
    animation-play-state: running;
  }

  /* Portal clone always spins fast */
  @keyframes spin-launch {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  .animate-spin-launch {
    animation: spin-launch 1.4 linear infinite !important;
  }

  @keyframes shimmer {
    0%, 100% { opacity: 0.18; }
    50%       { opacity: 0.35; }
  }

  @keyframes album-entrance {
    0%   { opacity: 0; transform: scale(1.4) translateY(30px); filter: blur(6px); }
    60%  { opacity: 1; filter: blur(0); }
    100% { transform: scale(1) translateY(0); }
  }
  .animate-album-entrance {
    animation: album-entrance 0.8s cubic-bezier(0.16, 1, 0.3, 1) both;
    animation-delay: var(--entrance-delay, 0s);
  }

  @keyframes skeleton-float {
    0%   { transform: translateY(0); }
    100% { transform: translateY(-6px); }
  }
  .animate-skeleton-float {
    animation: skeleton-float 2s ease-in-out infinite alternate;
  }

  @keyframes skeleton-shimmer {
    0%   { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }
  .animate-skeleton-shimmer {
    animation: skeleton-shimmer 1.8s ease-in-out infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    .animate-spin-hover,
    .animate-spin-launch,
    .animate-album-entrance,
    .animate-skeleton-float,
    .animate-skeleton-shimmer,
    .disc-grooves::after { animation: none !important; }
  }
</style>