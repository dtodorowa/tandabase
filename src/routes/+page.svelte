<script lang="ts">
  import { authState } from '$lib/stores/auth.svelte';
  import { getPublicSets } from '$lib/firebase/db';
  import { playerModal } from '$lib/stores/playerModal.svelte';
  import type { PracticaSet } from '$lib/types';
  import { Check, Upload, Play } from 'lucide-svelte';

  let sets = $state<PracticaSet[]>([]);
  let loading = $state(true);
  let randomSet = $state<PracticaSet | null>(null);

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
</script>

<svelte:head>
  <title>tandabase | Digital Tanda Archive</title>
</svelte:head>

<main class="grow pt-24 md:pt-32 bg-surface dark:bg-background text-ink selection:bg-ink selection:text-white dark:selection:bg-white dark:selection:text-black">

  <!-- Hero Section -->
  <section class="w-full min-h-[80vh] flex flex-col items-center justify-center relative px-6 text-center">
    <p class="z-3 text-ink-muted text-xs font-medium tracking-[0.25em] uppercase mb-8">v1.0 (Beta)</p>

    
    <h1 class="z-2 font-serif text-5xl md:text-[7rem] leading-[0.9] tracking-tighter max-w-5xl text-ink">
      A digital archive<br>
      <span class="italic text-ink-muted">for active listening.</span>
    </h1>

    <p class="z-3 mt-8 text-lg text-ink-muted max-w-xl font-light leading-relaxed">
      Turn your flat playlists into structured tandas. Share your sets with the community and discuss ideas.
    </p> 

   

    <div class="mt-12 flex gap-4 flex-wrap justify-center">
      <a href="/browse" class="group relative inline-flex items-center justify-center px-10 py-4 text-sm font-medium tracking-wide text-primary-foreground bg-primary rounded-full overflow-hidden transition-transform active:scale-95 shadow-xl shadow-black/10 hover:shadow-2xl hover:shadow-black/20 duration-300 no-underline">
        <span class="relative">Browse Sets</span>
      </a>

      <a href="/create" class="inline-flex items-center justify-center px-10 py-4 text-sm font-medium tracking-wide text-ink border border-black/10 dark:border-white/10 rounded-full transition-all hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 no-underline">
        Create Your Own
      </a>
    </div>
  </section>

  <!-- Community Sets Carousel -->
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
      {#if loading}
        {#each [0, 1, 2] as i}
          <div class="snap-center shrink-0 w-[85vw] md:w-[450px] aspect-square rounded-xl bg-black/5 dark:bg-white/5 animate-pulse"></div>
        {/each}
      {:else}
        {#each sets.slice(0, 7) as set, i (set.id)}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <div
            onclick={() => playerModal.openModal(set)}
            class="snap-center shrink-0 w-[85vw] md:w-[450px] aspect-square relative group cursor-pointer"
          >
            <div class="absolute -inset-6 bg-black/5 dark:bg-white/5 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
            <div class="w-full h-full rounded-xl overflow-hidden relative z-10 shadow-[0_10px_30px_rgba(0,0,0,0.05)] transition-transform duration-700 ease-spring group-hover:-translate-y-4 border border-black/5 dark:border-white/5 bg-card">
              <img src={getCover(set, i)} class="w-full h-[65%] object-cover grayscale opacity-90 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-700" alt={set.title}>
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

      <!-- Spacer -->
      <div class="snap-center shrink-0 w-[5vw] md:w-[10vw]"></div>
    </div>
  </section>

  <!-- How to use section -->
  <!-- <section class="w-full max-w-7xl mx-auto px-6 md:px-16 py-24 border-t border-black/5 dark:border-white/5 mb-24">
    <h2 class="font-serif text-4xl md:text-5xl font-bold mb-16 text-center">How to use <span class="italic text-ink-muted">tandabase</span></h2>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-16 md:gap-12">

      <div class="flex flex-col group">
        <span class="font-serif text-5xl italic text-ink-faint group-hover:text-ink transition-colors duration-500 mb-6">01.</span>
        <h3 class="font-medium text-xl text-ink mb-3 tracking-tight">Explore or Import</h3>
        <p class="text-ink-muted font-light leading-relaxed">Browse sets built by the community. Want to make your own? Drop in an Apple Music XML or CSV. The app auto-detects tandas and finds the YouTube links for you.</p>
      </div>

      <div class="flex flex-col group">
        <span class="font-serif text-5xl italic text-ink-faint group-hover:text-ink transition-colors duration-500 mb-6">02.</span>
        <h3 class="font-medium text-xl text-ink mb-3 tracking-tight">Active Listening</h3>
        <p class="text-ink-muted font-light leading-relaxed">Press play. When the song ends, it stops. Take a breath, check the orchestra, note the year, and manually click next. You're here to study, not to hit shuffle and walk away.</p>
      </div>

      <div class="flex flex-col group">
        <span class="font-serif text-5xl italic text-ink-faint group-hover:text-ink transition-colors duration-500 mb-6">03.</span>
        <h3 class="font-medium text-xl text-ink mb-3 tracking-tight">Fix Glitches</h3>
        <p class="text-ink-muted font-light leading-relaxed">The search function is still under development. If a track pulls up a wrong recording, hit "Wrong video?" to swap it out and help us fix things as a community.</p>
      </div>

    </div>
  </section> -->


  <!-- NOT a DJ tool -->
  <section class="w-full bg-ink-muted text-surface py-32 px-6 text-center my-32">
    <h2 class="font-serif text-5xl md:text-7xl tracking-tighter mb-8 text-surface">This is <span class="italic text-surface/50">NOT</span> a DJing app</h2>
    <p class="font-light text-xl text-surface/70 max-w-2xl mx-auto leading-relaxed">
      It's a learning tool. There is no autoplay or cortina gaps (on purpose). Just YouTube embeds for studying.<br><br>
      If you want to DJ a milonga, buy the music and support the people who are working hard to preserve tango recordings.
    </p>
  </section>

  <!-- Tanda Roulette -->
  <section class="w-full max-w-6xl mx-auto px-6 md:px-16 mb-32 flex flex-col items-center">
    <div class="text-center mb-16">
      <div class="font-mono text-xs text-ink-muted mb-4 uppercase tracking-widest">&gt; Tanda_Roulette</div>
      <h2 class="font-serif text-5xl md:text-6xl tracking-tight text-ink mb-4">Take it for a spin.</h2>
      <p class="font-sans text-xl text-ink-muted font-light">Drop the needle on a random set and see how the player works.</p>
    </div>

    {#if randomSet}
      <div class="w-full max-w-3xl bg-card rounded-3xl border border-black/10 dark:border-white/10 shadow-[0_30px_60px_rgba(0,0,0,0.08)] overflow-hidden">
        <div class="p-8 md:p-12 flex flex-col sm:flex-row gap-10 items-center">

               <!-- Spinning Vinyl Record -->
    <!-- <div class="vinyl-wrapper">
      <div class="vinyl">
      </div>
      <div class="vinyl-glow"></div>
    </div>
     -->

          <!-- Vinyl disc -->
          <div class="w-48 h-48 rounded-full bg-ink flex items-center justify-center shrink-0 relative shadow-2xl">
            <div class="absolute inset-2 border border-white/20 rounded-full"></div>
            <div class="absolute inset-6 border border-white/20 rounded-full"></div>
            <div class="absolute inset-10 border border-white/20 rounded-full"></div>
            <div class="w-16 h-16 bg-surface rounded-full flex items-center justify-center z-10 border border-black/10 dark:border-white/10">
              <div class="w-2 h-2 bg-ink rounded-full"></div>
            </div>
          </div>

          <div class="w-full">
            <span class="text-[10px] font-medium px-3 py-1 rounded-full bg-surface border border-black/5 dark:border-white/5 text-ink-muted mb-4 inline-block tracking-[0.2em] uppercase">Curated by @{randomSet.authorName}</span>
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


  <!-- Import Section -->
  <!-- <section class="w-full max-w-7xl mx-auto px-6 md:px-16 mb-32">
    <div class="flex flex-col lg:flex-row gap-20 items-center">
      <div class="lg:w-1/2">
        <div class="font-mono text-xs text-ink-muted mb-6 uppercase tracking-widest">&gt; sys.import_module</div>
        <h2 class="font-serif text-5xl md:text-6xl tracking-tight mb-8">Free your<br><span class="italic text-ink-muted">spreadsheets.</span></h2>
        <p class="text-xl text-ink/80 dark:text-ink-muted font-light leading-relaxed mb-8">
          Got your life's work trapped in an Apple Music XML or a massive, dusty CSV file? Drop it here. <strong class="font-medium text-ink">tandabase</strong> auto-detects the tandas, reads the metadata, and hunts down the YouTube links for you automatically.
        </p>
        <ul class="space-y-3 font-mono text-sm text-ink-muted">
          <li class="flex items-center gap-3"><Check class="w-4 h-4 text-ink" /> Supports .CSV uploads</li>
          <li class="flex items-center gap-3"><Check class="w-4 h-4 text-ink" /> Supports Apple Music .XML</li>
          <li class="flex items-center gap-3"><Check class="w-4 h-4 text-ink" /> Auto-fetches YouTube URLs</li>
        </ul>
      </div>

      <div class="lg:w-1/2 w-full">
        <div class="bg-card rounded-2xl border border-black/10 dark:border-white/10 shadow-xl overflow-hidden">
          <div class="bg-surface px-4 py-3 border-b border-black/5 dark:border-white/5 flex items-center gap-2">
            <div class="w-3 h-3 rounded-full bg-red-400"></div>
            <div class="w-3 h-3 rounded-full bg-amber-400"></div>
            <div class="w-3 h-3 rounded-full bg-green-400"></div>
          </div>
          <div class="p-8">
            <a href="/import" class="no-underline border-2 border-dashed border-black/15 dark:border-white/15 bg-surface/50 rounded-xl p-16 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-surface transition-colors">
              <Upload class="w-12 h-12 text-ink-faint mb-6" />
              <h3 class="font-medium text-lg text-ink mb-2">Drag & drop files here</h3>
              <p class="text-sm text-ink-muted font-light mb-8">Limit 5MB per file &bull; CSV, XML</p>
              <span class="px-6 py-2.5 rounded-full bg-card border border-black/10 dark:border-white/10 text-sm font-medium hover:bg-surface transition-colors shadow-sm inline-block">
                Browse Computer
              </span>
            </a>
          </div>
        </div>
      </div>
    </div>
  </section> -->

  <!-- Orchestra Marquee -->
  <!-- <section class="py-12 border-y border-black/5 dark:border-white/5 overflow-hidden relative flex items-center mb-32 bg-card">
    <div class="whitespace-nowrap flex font-serif text-5xl md:text-6xl italic text-ink-faint uppercase tracking-widest">
      <div class="animate-marquee">
        DI SARLI &bull; D'ARIENZO &bull; PUGLIESE &bull; TROILO &bull; CAL&Oacute; &bull; BIAGI &bull; DE CARO &bull; CANARO &bull; DI SARLI &bull; D'ARIENZO &bull; PUGLIESE &bull; TROILO &bull; CAL&Oacute; &bull; BIAGI &bull; DE CARO &bull; CANARO &bull;&nbsp;
      </div>
    </div>
  </section> -->

  <!-- Community Fix Section -->
  <!-- <section class="w-full max-w-6xl mx-auto px-6 md:px-16 mb-24">
    <div class="flex flex-col md:flex-row gap-16 items-center">
      <div class="md:w-1/2">
        <div class="font-mono text-xs text-ink-muted mb-4 uppercase tracking-widest">/* Community_Driven */</div>
        <h2 class="font-serif text-5xl md:text-6xl tracking-tight mb-6">Fix the <span class="italic text-ink-faint line-through">algorithm.</span></h2>
        <p class="text-lg text-ink/80 dark:text-ink-muted font-light leading-relaxed mb-6">
          YouTube's search API is great, but it's not perfect. Sometimes it pulls up a terrible 2015 cover instead of the gritty 1944 original.
        </p>
        <p class="text-lg text-ink/80 dark:text-ink-muted font-light leading-relaxed">
          Notice a mismatch? Hit <strong class="font-medium">? Wrong video</strong>. You can swap it out for the correct link. Over time, the community builds the most accurate database of tango music on the internet.
        </p>
      </div>

      <div class="md:w-1/2 w-full flex justify-center">
        <div class="bg-card rounded-2xl border border-black/10 dark:border-white/10 shadow-[0_20px_40px_rgba(0,0,0,0.05)] p-8 w-full max-w-md relative hover:-translate-y-2 transition-transform duration-500">

          <div class="flex items-center gap-3 mb-8 pb-4 border-b border-black/5 dark:border-white/5">
            <div class="w-2 h-2 rounded-full bg-amber-500"></div>
            <span class="font-mono text-xs text-ink uppercase tracking-widest">Metadata Mismatch</span>
          </div>

          <div class="space-y-6">
            <div>
              <label class="block text-xs font-medium text-ink-muted uppercase tracking-widest mb-2">Paste correct YouTube URL</label>
              <input type="text" value="https://youtube.com/watch?v=gr1tty..." readonly class="w-full bg-surface border border-black/10 dark:border-white/10 rounded-lg p-3 font-mono text-sm text-ink outline-none focus:border-ink transition-colors" />
            </div>
            <button class="w-full bg-ink text-primary-foreground font-medium text-sm py-3 rounded-xl hover:opacity-80 transition-colors shadow-lg cursor-pointer border-none">
              Override Video
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>  -->


  <!-- Footer -->
  <footer class="bg-card border-t border-black/5 dark:border-white/5 pt-20 pb-10 px-6 md:px-16 mt-auto">
    <div class="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-16 mb-20">

      <div class="lg:col-span-1">
        <a href="/" class="font-serif text-3xl italic tracking-tight text-ink block mb-6 no-underline">tandabase.</a>
        <p class="text-ink-muted font-light leading-relaxed max-w-sm mb-8">
          An ad-less, open-source player for tango nerds to build, share, and study tandas. 
        </p>
        <div class="font-mono text-xs text-ink/40 uppercase tracking-widest">
          &gt; System_Status: Online
        </div>
      </div>

      <div>
        <h3 class="font-mono text-xs text-ink uppercase tracking-widest mb-6">/* Actively Building */</h3>
        <ul class="space-y-4 text-sm font-light text-ink-muted list-none p-0">
          <li class="flex items-center gap-3 text-ink/40 line-through">
            <Check class="w-4 h-4" />
            Desktop editor redesign
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
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  @keyframes shimmer {
    0%, 100% { opacity: 0.18; }
    50% { opacity: 0.35; }
  }
  .vinyl-wrapper {
    position:relative;
    z-index: 1;
    width: 220px;
    height: 220px;
    margin: 3rem auto 0;
  }
  @media (min-width: 768px) {
    .vinyl-wrapper { width: 280px; height: 280px; }
  }
  .vinyl {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background:
      radial-gradient(circle at center, #111 3%, transparent 3.5%),
      radial-gradient(circle at center, #c0392b 0%, #e74c3c 8%, #d63031 14%, #b71c1c 18%, transparent 18.5%),
      radial-gradient(circle at center,
        transparent 19%,
        rgba(40,40,40,0.9) 19.5%,
        rgba(30,30,30,1) 22%,
        rgba(50,50,50,0.7) 24%,
        rgba(25,25,25,1) 26%,
        rgba(45,45,45,0.8) 28%,
        rgba(20,20,20,1) 30%,
        rgba(50,50,50,0.6) 33%,
        rgba(25,25,25,1) 36%,
        rgba(40,40,40,0.8) 39%,
        rgba(20,20,20,1) 42%,
        rgba(55,55,55,0.6) 45%,
        rgba(22,22,22,1) 48%,
        rgba(18,18,18,1) 50%
      );
    background-color: #181818;
    animation: spin 12s linear infinite;
    box-shadow:
      0 0 0 1px rgba(255,255,255,0.04),
      0 2px 20px rgba(0,0,0,0.15),
      0 8px 40px rgba(0,0,0,0.08);
    position: relative;
  }
  .vinyl::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: conic-gradient(
      from 0deg,
      transparent 0deg,
      rgba(255,255,255,0.08) 40deg,
      rgba(255,255,255,0.15) 55deg,
      transparent 80deg,
      transparent 180deg,
      rgba(255,255,255,0.05) 220deg,
      rgba(255,255,255,0.1) 235deg,
      transparent 260deg,
      transparent 360deg
    );
    animation: shimmer 3s ease-in-out infinite;
    pointer-events: none;
  }
  .vinyl-label-text {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 36%;
    height: 36%;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  }
  .vinyl-label-text span {
    font-family: 'Inter', sans-serif;
    font-size: 7px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.7);
    font-weight: 500;
  }
  .vinyl-glow {
    position: absolute;
    bottom: -8px;
    left: 50%;
    transform: translateX(-50%);
    width: 60%;
    height: 20px;
    background: radial-gradient(ellipse, rgba(0,0,0,0.12) 0%, transparent 70%);
    border-radius: 50%;
  }
</style>
