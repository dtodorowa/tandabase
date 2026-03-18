<script lang="ts">
  import { authState } from '$lib/stores/auth.svelte';
  import { getUserSets, deleteSet } from '$lib/firebase/db';
  import type { PracticaSet } from '$lib/types';
  import { goto } from '$app/navigation';
  import { Search, Plus, Pencil, Trash2, Eye, EyeOff, ArrowUpDown } from 'lucide-svelte';

  let sets = $state<PracticaSet[]>([]);
  let loading = $state(true);
  let error = $state('');
  let searchQuery = $state('');
  let sortBy = $state<'updated' | 'created'>('updated');
  let deleteConfirmId = $state<string | null>(null);

  $effect(() => {
    if (!authState.loading && !authState.isLoggedIn) {
      goto('/');
    }
  });

  $effect(() => {
    if (authState.user) {
      loadSets();
    }
  });

  async function loadSets() {
    if (!authState.user) return;
    loading = true;
    error = '';
    try {
      sets = await getUserSets(authState.user.uid);
    } catch (e: any) {
      console.error('Failed to load sets:', e);
      error = e.message || 'Failed to load sets';
    } finally {
      loading = false;
    }
  }

  async function handleDelete(id: string) {
    if (deleteConfirmId === id) {
      await deleteSet(id);
      sets = sets.filter(s => s.id !== id);
      deleteConfirmId = null;
    } else {
      deleteConfirmId = id;
      setTimeout(() => { if (deleteConfirmId === id) deleteConfirmId = null; }, 3000);
    }
  }

  const filteredSets = $derived.by(() => {
    let result = sets;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s =>
        s.title.toLowerCase().includes(q) ||
        s.description?.toLowerCase().includes(q) ||
        s.tandas.some(t => t.orchestra.toLowerCase().includes(q))
      );
    }
    return [...result].sort((a, b) => {
      const dateA = sortBy === 'updated' ? (a.updated_at ?? a.created_at) : a.created_at;
      const dateB = sortBy === 'updated' ? (b.updated_at ?? b.created_at) : b.created_at;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });
  });

  function formatDate(d: Date | undefined): string {
    if (!d) return '';
    const date = d instanceof Date ? d : new Date(d);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function genreColor(genre: string): string {
    switch (genre) {
      case 'Tango': return 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400';
      case 'Milonga': return 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400';
      case 'Vals': return 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400';
      default: return 'bg-black/5 text-ink-muted dark:bg-white/5';
    }
  }
</script>

<svelte:head>
  <title>My Sets - Tandabase</title>
</svelte:head>

{#if authState.loading || loading}
  <div class="flex items-center justify-center min-h-[60vh] pt-28">
    <p class="text-ink-muted text-sm font-light">Loading...</p>
  </div>
{:else if authState.isLoggedIn}
  <div class="pt-28 md:pt-36 pb-16 bg-surface dark:bg-background text-ink min-h-screen">
    <div class="max-w-5xl mx-auto px-6 md:px-16 w-full">

      <!-- Header -->
      <div class="pt-8 pb-10 border-b border-black/10 dark:border-white/10 mb-8">
        <div class="font-mono text-xs text-ink-muted mb-4 uppercase tracking-widest">&gt; My_Sets</div>
        <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 class="font-serif text-5xl md:text-6xl font-bold text-ink tracking-tight leading-tight">My Sets</h1>
            <p class="text-lg text-ink-muted font-light mt-2">{sets.length} set{sets.length !== 1 ? 's' : ''} total</p>
          </div>
          <a
            href="/create"
            class="inline-flex items-center gap-2 px-5 py-2.5 bg-ink dark:bg-white text-white dark:text-ink rounded-xl text-sm font-medium hover:opacity-80 transition-all no-underline shadow-lg"
          >
            <Plus class="w-4 h-4" />
            New Set
          </a>
        </div>
      </div>

      {#if error}
        <div class="p-4 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 text-red-700 dark:text-red-400 text-sm mb-6">
          {error}
        </div>
      {:else if sets.length === 0}
        <!-- Empty state -->
        <div class="flex flex-col items-center justify-center py-20 text-center">
          <div class="w-32 h-32 rounded-2xl overflow-hidden mb-6 opacity-60">
            <img
              src="https://images.unsplash.com/photo-1619983081563-430f63602796?q=80&w=987&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
              alt=""
              class="w-full h-full object-cover"
            />
          </div>
          <h3 class="font-serif text-2xl text-ink mb-2">No sets yet</h3>
          <p class="text-sm text-ink-muted mb-6 max-w-xs">Create your first practica set to start building your milonga playlist.</p>
          <a
            href="/create"
            class="inline-flex items-center gap-2 px-6 py-3 bg-ink dark:bg-white text-white dark:text-ink rounded-xl text-sm font-medium hover:opacity-80 transition-all no-underline shadow-lg"
          >
            <Plus class="w-4 h-4" />
            Create your first set
          </a>
        </div>
      {:else}
        <!-- Search & Sort bar -->
        <div class="flex flex-col sm:flex-row gap-3 mb-6">
          <div class="relative flex-1">
            <Search class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
            <input
              type="text"
              placeholder="Search sets by title or orchestra..."
              bind:value={searchQuery}
              class="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-card border border-black/5 dark:border-white/5 rounded-xl text-sm text-ink outline-none focus:border-ink dark:focus:border-white transition-colors font-sans"
            />
          </div>
          <button
            onclick={() => sortBy = sortBy === 'updated' ? 'created' : 'updated'}
            class="flex items-center gap-2 px-4 py-2.5 border border-black/5 dark:border-white/5 rounded-xl text-xs font-medium text-ink-muted hover:text-ink hover:border-ink/30 dark:hover:border-white/30 transition-all cursor-pointer bg-white dark:bg-card font-sans shrink-0"
          >
            <ArrowUpDown class="w-3.5 h-3.5" />
            {sortBy === 'updated' ? 'Last updated' : 'Date created'}
          </button>
        </div>

        <!-- Cards grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {#each filteredSets as set (set.id)}
            <div class="group bg-white dark:bg-card rounded-2xl border border-black/5 dark:border-white/5 overflow-hidden hover:shadow-lg hover:border-black/15 dark:hover:border-white/15 transition-all">
              <!-- Card image -->
              <a href="/set/{set.id}" class="block relative h-36 overflow-hidden">
                <img
                  src={set.cover_image || 'https://images.unsplash.com/photo-1619983081563-430f63602796?q=80&w=987&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'}
                  alt=""
                  class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div class="absolute inset-0 bg-linear-to-t from-black/60 to-transparent"></div>
                <div class="absolute bottom-3 left-3 right-3 flex items-end justify-between">
                  <div class="flex gap-1.5">
                    {#each set.genre_summary as genre}
                      <span class="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest {genreColor(genre)}">
                        {genre}
                      </span>
                    {/each}
                  </div>
                  <span class="text-[10px] text-white/70 font-mono">
                    {set.visibility === 'public' ? '🌐' : '🔒'}
                  </span>
                </div>
              </a>

              <!-- Card body -->
              <div class="p-4">
                <a href="/set/{set.id}" class="block no-underline">
                  <h3 class="font-serif text-lg text-ink font-medium leading-snug truncate">{set.title}</h3>
                  <p class="text-xs text-ink-muted mt-1">
                    {set.tanda_count} tandas · {set.song_count} songs
                  </p>
                </a>

                <div class="flex items-center justify-between mt-4 pt-3 border-t border-black/5 dark:border-white/5">
                  <span class="text-[10px] text-ink-faint font-mono">
                    {formatDate(sortBy === 'updated' ? (set.updated_at ?? set.created_at) : set.created_at)}
                  </span>
                  <div class="flex gap-1.5">
                    <a
                      href="/create?edit={set.id}"
                      class="w-8 h-8 rounded-lg border border-black/5 dark:border-white/5 flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 hover:border-ink/30 dark:hover:border-white/30 transition-all no-underline"
                      title="Edit"
                    >
                      <Pencil class="w-3.5 h-3.5 text-ink-muted" />
                    </a>
                    <button
                      onclick={() => handleDelete(set.id!)}
                      class="w-8 h-8 rounded-lg border cursor-pointer bg-transparent font-sans flex items-center justify-center transition-all
                        {deleteConfirmId === set.id
                          ? 'border-tango bg-red-50 dark:bg-red-900/20'
                          : 'border-black/5 dark:border-white/5 hover:bg-black/5 dark:hover:bg-white/5 hover:border-ink/30 dark:hover:border-white/30'}"
                      title={deleteConfirmId === set.id ? 'Click again to confirm' : 'Delete'}
                    >
                      <Trash2 class="w-3.5 h-3.5 {deleteConfirmId === set.id ? 'text-tango' : 'text-ink-muted'}" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          {/each}
        </div>

        {#if filteredSets.length === 0 && searchQuery.trim()}
          <p class="text-center text-sm text-ink-muted py-12">No sets match "{searchQuery}"</p>
        {/if}
      {/if}
    </div>
  </div>
{/if}
