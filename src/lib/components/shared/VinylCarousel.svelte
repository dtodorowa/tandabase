<script lang="ts">
  import { playerModal } from '$lib/stores/playerModal.svelte';
  import type { PracticaSet } from '$lib/types';
  import { onMount } from 'svelte';

  interface Props {
    sets: PracticaSet[];
    displayCount?: number;
  }

  let { sets, displayCount = 6 }: Props = $props();

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

  const coverImages = [
    'album-covers/di-sarli.jpg',
    'album-covers/pugliese.jpg',
    'album-covers/troilo.jpg',
  ];

  let carouselItems = $derived.by(() => {
    const displaySets = sets.slice(0, displayCount);
    if (displaySets.length === 0) return [];
    return [...displaySets, ...displaySets, ...displaySets];
  });

  function getCover(set: PracticaSet, index: number): string {
    return set.cover_image || coverImages[index % coverImages.length];
  }

  function getAlbumId(set: PracticaSet): string {
    return set.id ?? set.title;
  }

  // ── Portal launch ──
  function launchRecord(albumEl: HTMLElement, set: PracticaSet) {
    const recordEl = albumEl.querySelector('.record') as HTMLElement | null;
    if (!recordEl) return;

    const rect = recordEl.getBoundingClientRect();

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

    const clone = recordEl.cloneNode(true) as HTMLElement;
    clone.querySelector('.disc')?.classList.add('animate-spin-launch');
    clone.style.cssText = `
      width: 100%;
      height: 100%;
      opacity: 1;
      transform: scale(1);
    `;
    portal.appendChild(clone);
    document.body.appendChild(portal);

    portal.getBoundingClientRect();

    portal.style.transition = 'transform 2s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease 0.45s';
    portal.style.transform = 'translateY(-85vh) scale(2.9)';
    portal.style.opacity = '0';

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
    const displaySets = sets.slice(0, displayCount);
    if (displaySets.length === 0) return;

    const itemWidth = 410;
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
        const displaySets = sets.slice(0, displayCount);
        scrollContainer.scrollLeft = displaySets.length * 410;
      });
    }
  });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<section class="w-full min-h-[80vh] flex flex-col items-center justify-center relative text-center">
  <div class="relative w-full z-2">
    {#if sets.length === 0}
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
        class="carousel-row flex gap-18 no-scrollbar px-16 pb-10 items-end"
        style="padding-top: 200px; scroll-behavior: auto;"
        bind:this={scrollContainer}
        onscroll={handleScroll}
        onmouseenter={pauseAutoScroll}
        onmouseleave={resumeAutoScroll}
      >
        {#each carouselItems as set, i}
          {@const realIndex = i % sets.slice(0, displayCount).length}
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
              <!-- <div class="absolute bottom-0 left-0 right-0 px-3.5 pt-8 pb-3 bg-linear-to-t from-black/75 to-transparent flex flex-col gap-0.5 pointer-events-none select-none">
                <span class="font-serif text-[15px] font-medium text-white truncate leading-snug">{set.title}</span>
                <span class="text-[11px] text-white/60 tracking-[0.06em] uppercase">{set.authorName}</span>
              </div> -->
            </div>

            <!-- record-portal: sits above sleeve, overflow visible -->
            <div class="record-portal">
              <div class="record" class:launching-hide={isLaunching}>
                <div class="disc animate-spin-hover">
                  <div class="disc-grooves"></div>
                  <div class="disc-label">
                    <div class="disc-hole">
                    </div>
                </div>
                </div>
              </div>
            </div>

          </div>
        {/each}
      
      </div>
    {/if}

  </div>

  <p class="mt-6 text-sm font-light text-ink-muted/50 italic tracking-wide select-none pointer-events-none">
    tap a sleeve to spin the records
  </p>
</section>

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
    transition:
      transform 0.3s cubic-bezier(0.2, 0.9, 0.2, 1),
      filter 0.3s ease,
      z-index 0s;
    overflow: visible;
    z-index: 1;
  }
  /* When row is hovered, dim all albums… */
  .carousel-row:hover .album {
    filter: brightness(0.90) blur(2px);
  }
  /* …except the one being hovered */
  .carousel-row:hover .album:hover,
  .album:active {
    transform: translateY(-4px) scale(1.05);
    z-index: 10;
    filter: brightness(1) blur(0px);
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
    right: -40px;
    top: 50%;
    width: 220px;
    height: 220px;
    margin-top: -110px;
    overflow: visible;
    z-index: 1;
    pointer-events: none;
  }

  /* ── Vinyl record ── */
  .record {
    width: 220px;
    height: 220px;
    transform: translateX(0) scale(1);
    opacity: 0.7;
    transition:
      transform 0.38s cubic-bezier(0.2, 0.9, 0.2, 1),
      opacity 0.3s ease;
  }
  .album:not(.is-launching):hover .record {
    opacity: 1;
    transform: translateX(80px) translateY(-20px) scale(1);
  }
  .record.launching-hide {
    opacity: 0 !important;
    transform: translateX(-20px) scale(0.7) !important;
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
