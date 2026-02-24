<script lang="ts">
  import { authState } from '$lib/stores/auth.svelte';
  import { goto } from '$app/navigation';
  import { getFlagsForOwner, resolveFlag } from '$lib/firebase/db';
  import type { VideoFlag } from '$lib/types';

  let loading = $state(true);
  let flags = $state<VideoFlag[]>([]);
  let error = $state('');

  $effect(() => {
    if (!authState.loading && !authState.isLoggedIn) {
      goto('/');
      return;
    }
    if (authState.user) {
      loadFlags();
    }
  });

  async function loadFlags() {
    loading = true;
    error = '';
    try {
      flags = await getFlagsForOwner(authState.user!.uid);
    } catch (e: any) {
      console.error('Failed to load flags:', e);
      error = e.message || 'Failed to load notifications.';
    } finally {
      loading = false;
    }
  }

  async function handleResolve(flag: VideoFlag) {
    if (!flag.id) return;
    try {
      await resolveFlag(flag.id);
      flags = flags.filter(f => f.id !== flag.id);
    } catch (e) {
      console.error('Failed to resolve flag:', e);
    }
  }

  function goToSong(flag: VideoFlag) {
    goto(`/set/${flag.setId}`);
  }

  function formatDate(d: any): string {
    if (!d) return '';
    const date = d.toDate ? d.toDate() : (d instanceof Date ? d : new Date(d));
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
</script>

<svelte:head>
  <title>Notifications - Practica Set</title>
</svelte:head>

<div class="notif-page">
  <div class="page-header">
    <h1>Notifications</h1>
    <p class="subtitle">Flags from other listeners on your sets</p>
  </div>

  {#if loading}
    <div class="empty-state">Loading...</div>
  {:else if error}
    <div class="empty-state error">{error}</div>
  {:else if flags.length === 0}
    <div class="empty-state">
      <div class="empty-icon">&#10003;</div>
      <p>All clear! No open flags on your sets.</p>
    </div>
  {:else}
    <div class="flag-list">
      {#each flags as flag}
        <div class="flag-card">
          <div class="flag-top">
            <div class="flag-info">
              <span class="flag-set">{flag.setTitle || 'Unknown set'}</span>
              <span class="flag-dot">&middot;</span>
              <span class="flag-song">"{flag.songTitle}"</span>
              <span class="flag-dot">&middot;</span>
              <span class="flag-tanda">Tanda {flag.tandaIndex + 1}, Song {flag.songIndex + 1}</span>
            </div>
            <span class="flag-date">{formatDate(flag.created_at)}</span>
          </div>
          <div class="flag-reason">
            <span class="flag-by">{flag.flaggedByName}</span> says: {flag.reason}
          </div>
          <div class="flag-actions">
            <button class="flag-go-btn" onclick={() => goToSong(flag)}>
              Go to set &rarr;
            </button>
            <button class="flag-resolve-btn" onclick={() => handleResolve(flag)}>
              Mark resolved
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .notif-page {
    max-width: 700px;
    margin: 0 auto;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }
  .page-header h1 {
    font-family: 'Space Grotesk', sans-serif;
    font-size: var(--fs-heading);
    font-weight: 700;
    letter-spacing: -0.02em;
  }
  .subtitle {
    font-size: var(--fs-xs);
    color: var(--text-dim);
    margin-top: 0.15rem;
  }
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 1rem;
    color: var(--text-dim);
    font-size: var(--fs-sm);
    gap: 0.5rem;
  }
  .empty-state.error { color: var(--tango); }
  .empty-icon {
    font-size: var(--fs-display);
    color: var(--vals);
    opacity: 0.6;
  }

  .flag-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .flag-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-left: 3px solid var(--tango);
    border-radius: var(--radius);
    padding: 0.8rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .flag-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .flag-info {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    flex-wrap: wrap;
    font-size: var(--fs-xs);
  }
  .flag-set {
    font-weight: 600;
    color: var(--text);
  }
  .flag-song {
    color: var(--accent);
    font-weight: 500;
  }
  .flag-tanda {
    color: var(--text-dim);
    font-size: var(--fs-label);
  }
  .flag-dot {
    color: var(--text-dim);
    font-size: var(--fs-label);
  }
  .flag-date {
    font-size: var(--fs-label);
    color: var(--text-dim);
    white-space: nowrap;
    flex-shrink: 0;
  }
  .flag-reason {
    font-size: var(--fs-xs);
    color: var(--text-mid);
    line-height: 1.4;
  }
  .flag-by {
    font-weight: 500;
    color: var(--text);
  }
  .flag-actions {
    display: flex;
    gap: 0.4rem;
    margin-top: 0.2rem;
  }
  .flag-go-btn {
    background: var(--accent-dim);
    border: 1px solid var(--accent);
    color: var(--accent);
    padding: 0.25rem 0.7rem;
    font-size: var(--fs-label);
    font-weight: 500;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all 0.12s;
    font-family: 'Outfit', sans-serif;
  }
  .flag-go-btn:hover { background: var(--accent); color: var(--bg); }
  .flag-resolve-btn {
    background: none;
    border: 1px solid var(--border);
    color: var(--text-dim);
    padding: 0.25rem 0.7rem;
    font-size: var(--fs-label);
    font-weight: 500;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all 0.12s;
    font-family: 'Outfit', sans-serif;
  }
  .flag-resolve-btn:hover { border-color: var(--vals); color: var(--vals); }

  @media (max-width: 600px) {
    .notif-page { padding: 1rem; }
    .flag-info { font-size: var(--fs-2xs); }
  }
</style>
