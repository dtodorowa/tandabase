<script lang="ts">
  import { authState } from '$lib/stores/auth.svelte';
  import { getUserSets, deleteSet } from '$lib/firebase/db';
  import type { PracticaSet } from '$lib/types';
  import { goto } from '$app/navigation';
  import GenreBadge from '$lib/components/shared/GenreBadge.svelte';

  let sets = $state<PracticaSet[]>([]);
  let loading = $state(true);
  let error = $state('');

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
      console.log('[my-sets] Loaded', sets.length, 'sets for user', authState.user.uid);
    } catch (e: any) {
      console.error('Failed to load sets:', e);
      error = e.message || 'Failed to load sets';
    } finally {
      loading = false;
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this set?')) return;
    await deleteSet(id);
    sets = sets.filter(s => s.id !== id);
  }
</script>

<svelte:head>
  <title>My Sets - Tandabase</title>
</svelte:head>

<div class="my-sets-page">
  <div class="page-header">
    <h1>My Sets</h1>
    <a href="/create" class="new-btn">+ New Set</a>
  </div>

  {#if authState.loading || loading}
    <div class="loading">Loading...</div>
  {:else if error}
    <div class="loading" style="color: var(--tango);">{error}</div>
  {:else if sets.length === 0}
    <div class="empty">
      <p>You haven't created any sets yet.</p>
      <a href="/create" class="start-btn">Create your first set &rarr;</a>
    </div>
  {:else}
    <div class="sets-list">
      {#each sets as set (set.id)}
        <div class="set-row">
          {#if set.cover_image}
            <a href="/set/{set.id}" class="set-thumb-link">
              <img src={set.cover_image} alt="" class="set-thumb" />
            </a>
          {/if}
          <a href="/set/{set.id}" class="set-info">
            <h3>{set.title}</h3>
            <div class="set-meta">
              <span class="vis-badge" class:public={set.visibility === 'public'}>
                {set.visibility}
              </span>
              <span>{set.tanda_count} tandas &middot; {set.song_count} songs</span>
              {#each set.genre_summary as genre}
                <GenreBadge {genre} size="sm" />
              {/each}
            </div>
          </a>
          <div class="set-actions">
            <a href="/create?edit={set.id}" class="action-btn">Edit</a>
            <button class="action-btn danger" onclick={() => handleDelete(set.id!)}>Delete</button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .my-sets-page {
    max-width: 800px;
    margin: 0 auto;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }
  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .page-header h1 {
    font-family: 'Space Grotesk', sans-serif;
    font-size: var(--fs-heading);
    font-weight: 700;
    letter-spacing: -0.02em;
  }
  .new-btn {
    background: var(--accent);
    color: var(--bg);
    padding: 0.5rem 1rem;
    border-radius: var(--radius-sm);
    font-size: var(--fs-xs);
    font-weight: 600;
    text-decoration: none;
    transition: all 0.15s;
  }
  .new-btn:hover { background: var(--accent-bright); }
  .loading, .empty {
    text-align: center;
    padding: 3rem;
    color: var(--text-dim);
    font-size: var(--fs-sm);
  }
  .start-btn {
    display: inline-block;
    margin-top: 0.75rem;
    color: var(--accent);
    font-weight: 500;
    font-size: var(--fs-sm);
  }
  .sets-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .set-row {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.8rem 1rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    transition: all 0.12s;
  }
  .set-row:hover { border-color: var(--border-light); }
  .set-thumb-link {
    flex-shrink: 0;
  }
  .set-thumb {
    width: 64px;
    height: 40px;
    object-fit: cover;
    border-radius: var(--radius-sm);
    display: block;
  }
  .set-info {
    flex: 1;
    min-width: 0;
    text-decoration: none;
    color: var(--text);
  }
  .set-info h3 {
    font-family: 'Space Grotesk', sans-serif;
    font-size: var(--fs-sm);
    font-weight: 600;
  }
  .set-meta {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin-top: 0.2rem;
    font-size: var(--fs-label);
    color: var(--text-dim);
    flex-wrap: wrap;
  }
  .vis-badge {
    padding: 0.1rem 0.35rem;
    border-radius: 3px;
    font-size: var(--fs-micro);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    background: var(--surface2);
    border: 1px solid var(--border);
    color: var(--text-dim);
  }
  .vis-badge.public {
    background: var(--accent-dim);
    border-color: var(--accent);
    color: var(--accent);
  }
  .set-actions {
    display: flex;
    gap: 0.35rem;
    flex-shrink: 0;
  }
  .action-btn {
    background: var(--surface2);
    border: 1px solid var(--border);
    color: var(--text-mid);
    padding: 0.3rem 0.6rem;
    font-size: var(--fs-label);
    font-weight: 500;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all 0.15s;
    text-decoration: none;
    font-family: 'Outfit', sans-serif;
  }
  .action-btn:hover { border-color: var(--accent); color: var(--accent); }
  .action-btn.danger:hover { border-color: var(--tango); color: var(--tango); }
</style>
