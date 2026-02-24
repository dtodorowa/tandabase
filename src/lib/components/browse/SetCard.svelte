<script lang="ts">
  import type { PracticaSet } from '$lib/types';
  import GenreBadge from '$lib/components/shared/GenreBadge.svelte';

  let { set }: { set: PracticaSet } = $props();
</script>

<a href="/set/{set.id}" class="set-card">
  {#if set.cover_image}
    <div class="card-cover">
      <img src={set.cover_image} alt="" />
    </div>
  {/if}
  <div class="card-body">
    <div class="card-header">
      <h3>{set.title}</h3>
      {#if set.description}
        <p class="card-desc">{set.description}</p>
      {/if}
    </div>
    <div class="card-meta">
      <span class="author">{set.authorName}</span>
      <span class="stats">{set.tanda_count} tandas &middot; {set.song_count} songs</span>
    </div>
    <div class="card-genres">
      {#each set.genre_summary as genre}
        <GenreBadge {genre} size="sm" />
      {/each}
    </div>
  </div>
</a>

<style>
  .set-card {
    display: flex;
    flex-direction: column;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    transition: all 0.15s;
    text-decoration: none;
    color: var(--text);
    overflow: hidden;
  }
  .set-card:hover {
    border-color: var(--accent);
    background: var(--surface2);
  }
  .card-cover {
    width: 100%;
    aspect-ratio: 16/9;
    overflow: hidden;
    flex-shrink: 0;
  }
  .card-cover img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .card-body {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 1rem;
  }
  .card-header h3 {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 1rem;
    font-weight: 600;
    letter-spacing: -0.01em;
  }
  .card-desc {
    font-size: 0.72rem;
    color: var(--text-dim);
    margin-top: 0.15rem;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .card-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .author {
    font-size: 0.68rem;
    color: var(--text-mid);
    font-weight: 500;
  }
  .stats {
    font-size: 0.62rem;
    color: var(--text-dim);
    font-family: 'JetBrains Mono', monospace;
  }
  .card-genres {
    display: flex;
    gap: 0.3rem;
    flex-wrap: wrap;
  }
</style>
