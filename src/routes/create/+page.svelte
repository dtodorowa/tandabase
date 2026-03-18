<script lang="ts">
  import { authState } from '$lib/stores/auth.svelte';
  import { editor } from '$lib/stores/editor.svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { getSet } from '$lib/firebase/db';
  import TandaBuilderPanel from '$lib/components/editor/TandaBuilderPanel.svelte';
  import { Plus, Minus, Save, Eye, EyeOff } from 'lucide-svelte';
  import type { Genre } from '$lib/types';
  import { untrack } from 'svelte';

  let loading = $state(false);
  let openSlotIndex = $state<number | null>(null);
  let tandaCount = $state(4);
  let didInit = false;

  $effect(() => {
    if (!authState.loading && !authState.isLoggedIn) {
      goto('/');
    }
  });

  $effect(() => {
    const editId = page.url.searchParams.get('edit');
    if (didInit) return;
    didInit = true;
    if (editId) {
      loadExisting(editId);
    } else {
      untrack(() => {
        editor.reset();
        syncTandaCount();
      });
    }
  });

  async function loadExisting(id: string) {
    loading = true;
    try {
      const set = await getSet(id);
      if (set) {
        editor.loadExisting(set);
        tandaCount = set.tandas.length;
      }
    } catch (e) {
      console.error('Failed to load set for editing:', e);
    } finally {
      loading = false;
    }
  }

  function syncTandaCount() {
    while (editor.tandas.length < tandaCount) {
      editor.addTanda();
    }
    while (editor.tandas.length > tandaCount) {
      const last = editor.tandas[editor.tandas.length - 1];
      if (last) editor.removeTanda(last.id);
    }
  }

  function adjustCount(delta: number) {
    const next = Math.max(1, Math.min(20, tandaCount + delta));
    if (next === tandaCount) return;
    tandaCount = next;
    syncTandaCount();
  }

  function getSlotSummary(index: number): { orchestra: string; genre: Genre; songCount: number; filled: boolean } {
    const tanda = editor.tandas[index];
    if (!tanda) return { orchestra: '', genre: 'Tango', songCount: 0, filled: false };
    return {
      orchestra: tanda.orchestra || '',
      genre: tanda.genre,
      songCount: tanda.songs.length,
      filled: tanda.songs.length > 0,
    };
  }

  async function handleSave() {
    if (!authState.user) return;
    const id = await editor.save(
      authState.user.uid,
      authState.user.displayName ?? 'Anonymous'
    );
    goto(`/set/${id}`);
  }
</script>

<svelte:head>
  <title>{editor.setId ? 'Edit Set' : 'Create Set'} - Tandabase</title>
</svelte:head>

{#if authState.loading || loading}
  <div class="flex items-center justify-center min-h-[60vh] pt-28">
    <p class="text-ink-muted text-sm font-light">Loading...</p>
  </div>
{:else if authState.isLoggedIn}
  <div class="pt-28 md:pt-36 pb-16 bg-surface dark:bg-background text-ink min-h-screen">
    <div class="max-w-[1400px] mx-auto px-6 md:px-16 w-full">

      <!-- Header -->
      <div class="pt-8 pb-12 border-b border-black/10 dark:border-white/10 mb-12">
        <div class="font-mono text-xs text-ink-muted mb-4 uppercase tracking-widest">&gt; Set_Architect</div>
        <h1 class="font-serif text-5xl md:text-6xl font-bold text-ink tracking-tight leading-tight">
          {editor.setId ? 'Edit Set' : 'New Set'}
        </h1>
        <p class="text-lg text-ink-muted font-light max-w-xl mt-4">
          Define the structure, pick orchestras, and fill each tanda from the discography.
        </p>
      </div>

      <div class="flex flex-col lg:flex-row gap-12 items-start">

        <!-- Left: Global parameters (sticky) -->
        <div class="w-full lg:w-1/3 bg-white dark:bg-card p-8 rounded-2xl border border-black/5 dark:border-white/5 shadow-sm lg:sticky lg:top-32 space-y-8">
          <h3 class="font-medium text-lg text-ink border-b border-black/5 dark:border-white/5 pb-4">Set Details</h3>

          <div>
            <span class="text-xs font-medium text-ink uppercase tracking-widest mb-2 block">Title</span>
            <input
              type="text"
              bind:value={editor.title}
              placeholder="My Practica Set"
              class="w-full bg-surface dark:bg-background border border-black/5 dark:border-white/5 rounded-xl px-4 py-3 text-sm text-ink outline-none focus:border-ink dark:focus:border-white transition-colors font-sans"
            />
          </div>

          <div>
            <span class="text-xs font-medium text-ink uppercase tracking-widest mb-2 block">Description</span>
            <textarea
              bind:value={editor.description}
              placeholder="What's this set about?"
              rows="3"
              class="w-full bg-surface dark:bg-background border border-black/5 dark:border-white/5 rounded-xl px-4 py-3 text-sm text-ink outline-none focus:border-ink dark:focus:border-white transition-colors font-sans resize-none"
            ></textarea>
          </div>

          <div>
            <span class="text-xs font-medium text-ink uppercase tracking-widest mb-2 block">Cover Image</span>
            <input
              type="text"
              bind:value={editor.cover_image}
              placeholder="https://..."
              class="w-full bg-surface dark:bg-background border border-black/5 dark:border-white/5 rounded-xl px-4 py-3 text-sm text-ink outline-none focus:border-ink dark:focus:border-white transition-colors font-sans"
            />
            {#if editor.cover_image}
              <img src={editor.cover_image} alt="Cover" class="mt-3 w-full h-32 object-cover rounded-xl border border-black/5 dark:border-white/5" />
            {/if}
          </div>

          <div>
            <div class="flex justify-between items-center mb-4">
              <span class="text-xs font-medium text-ink uppercase tracking-widest">Number of Tandas</span>
              <span class="font-mono text-sm text-ink-muted">{tandaCount}</span>
            </div>
            <div class="flex items-center gap-4">
              <button
                onclick={() => adjustCount(-1)}
                disabled={tandaCount <= 1}
                class="w-10 h-10 rounded-full border border-black/10 dark:border-white/10 flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer bg-transparent disabled:opacity-30 disabled:cursor-default"
              >
                <Minus class="w-4 h-4" />
              </button>
              <div class="flex-1 h-1 bg-black/5 dark:bg-white/5 rounded-full relative">
                <div
                  class="h-full bg-ink dark:bg-white rounded-full transition-all"
                  style="width: {(tandaCount / 20) * 100}%"
                ></div>
              </div>
              <button
                onclick={() => adjustCount(1)}
                disabled={tandaCount >= 20}
                class="w-10 h-10 rounded-full border border-black/10 dark:border-white/10 flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer bg-transparent disabled:opacity-30 disabled:cursor-default"
              >
                <Plus class="w-4 h-4" />
              </button>
            </div>
          </div>

          <!-- Visibility toggle -->
          <div>
            <button
              onclick={() => editor.visibility = editor.visibility === 'public' ? 'private' : 'public'}
              class="flex items-center gap-3 w-full p-3 rounded-xl border border-black/5 dark:border-white/5 hover:bg-black/5 dark:hover:bg-white/5 transition-all cursor-pointer bg-transparent font-sans"
            >
              {#if editor.visibility === 'public'}
                <Eye class="w-4 h-4 text-vals" />
                <span class="text-sm font-medium text-ink">Public</span>
                <span class="text-xs text-ink-muted ml-auto">Anyone can find this</span>
              {:else}
                <EyeOff class="w-4 h-4 text-ink-muted" />
                <span class="text-sm font-medium text-ink">Private</span>
                <span class="text-xs text-ink-muted ml-auto">Only you</span>
              {/if}
            </button>
          </div>

          <!-- Save button -->
          <button
            onclick={handleSave}
            disabled={editor.saving || !editor.title.trim()}
            class="w-full py-3.5 bg-ink dark:bg-white text-white dark:text-ink rounded-xl text-sm font-medium hover:opacity-80 transition-all cursor-pointer border-none font-sans shadow-lg disabled:opacity-30 disabled:cursor-default flex items-center justify-center gap-2"
          >
            <Save class="w-4 h-4" />
            {editor.saving ? 'Saving...' : (editor.setId ? 'Update Set' : 'Save Set')}
          </button>

          <div class="text-center">
            <span class="text-xs text-ink-faint">
              {editor.tandaCount} tandas · {editor.songCount} songs
            </span>
          </div>
        </div>

        <!-- Right: Tanda slots grid -->
        <div class="w-full lg:w-2/3">
          <div class="flex justify-between items-end mb-6">
            <h3 class="font-serif text-3xl text-ink">Timeline</h3>
            <span class="text-sm font-medium text-ink-muted bg-surface dark:bg-background px-4 py-1.5 rounded-full border border-black/5 dark:border-white/5">
              {tandaCount} Tandas · {editor.songCount} Songs
            </span>
          </div>

          <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {#each editor.tandas as tanda, i (tanda.id)}
              {@const summary = getSlotSummary(i)}
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <div
                onclick={() => openSlotIndex = i}
                class="group relative rounded-xl p-5 cursor-pointer transition-all border-2
                  {summary.filled
                    ? 'bg-white dark:bg-card border-black/10 dark:border-white/10 hover:border-ink dark:hover:border-white shadow-sm hover:shadow-md'
                    : 'bg-surface dark:bg-background border-dashed border-black/15 dark:border-white/15 hover:bg-white dark:hover:bg-card hover:border-ink/50 dark:hover:border-white/50 hover:shadow-md'}"
              >
                <span class="font-mono text-[10px] font-bold text-ink-muted">#{String(i + 1).padStart(2, '0')}</span>

                {#if summary.filled}
                  <h4 class="font-serif text-xl text-ink mt-2 leading-tight">{summary.orchestra}</h4>
                  <div class="flex items-center gap-2 mt-2">
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-widest
                      {summary.genre === 'Tango' ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400' :
                       summary.genre === 'Milonga' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' :
                       'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'}">
                      {summary.genre}
                    </span>
                    <span class="text-xs text-ink-muted">{summary.songCount} tracks</span>
                  </div>
                {:else}
                  <h4 class="font-serif text-2xl text-ink-faint mt-2 group-hover:text-ink transition-colors">Empty</h4>
                  <p class="text-xs text-ink-faint mt-1 group-hover:text-ink-muted transition-colors">Click to fill</p>
                {/if}
              </div>
            {/each}

            <!-- Add tanda slot -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <div
              onclick={() => adjustCount(1)}
              class="group relative bg-transparent border-2 border-dashed border-black/10 dark:border-white/10 rounded-xl p-5 cursor-pointer hover:border-ink/30 dark:hover:border-white/30 transition-all flex flex-col items-center justify-center min-h-[120px]"
            >
              <Plus class="w-6 h-6 text-ink-faint group-hover:text-ink transition-colors" />
              <span class="text-xs text-ink-faint group-hover:text-ink-muted mt-1 transition-colors">Add Tanda</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Builder Panel (side panel) -->
  {#if openSlotIndex !== null}
    <TandaBuilderPanel
      slotIndex={openSlotIndex}
      onclose={() => openSlotIndex = null}
    />
  {/if}
{/if}

