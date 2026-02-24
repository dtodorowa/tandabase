<script lang="ts">
  import { player } from '$lib/stores/player.svelte';
  import GenreBadge from '$lib/components/shared/GenreBadge.svelte';
</script>

<div class="tanda-header">
  <div class="tanda-number-big">
    {String((player.currentTanda?.num ?? 0)).padStart(2, '0')}
  </div>
  <div class="tanda-title-block">
    <h2>{player.currentTanda?.orchestra ?? '\u2014'}</h2>
    {#if player.currentTanda}
      <GenreBadge genre={player.currentTanda.genre} size="md" />
    {/if}
  </div>
  <div class="nav-buttons">
    <button class="nav-btn" disabled={player.isFirst} onclick={() => player.prev()} aria-label="Previous">
      <span>&#8249;</span><span class="btn-label">Prev</span>
    </button>
    <span class="song-counter">{player.songCounter}</span>
    <button class="nav-btn" disabled={player.isLast} onclick={() => player.next()} aria-label="Next">
      <span class="btn-label">Next</span><span>&#8250;</span>
    </button>
  </div>
</div>

<style>
  .tanda-header {
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    gap: 1rem;
    background: var(--surface);
    flex-shrink: 0;
  }
  .tanda-number-big {
    font-family: 'JetBrains Mono', monospace;
    font-size: var(--fs-display);
    color: var(--border-light);
    line-height: 1;
    font-weight: 500;
  }
  .tanda-title-block h2 {
    font-family: 'Space Grotesk', sans-serif;
    font-size: var(--fs-subheading);
    font-weight: 600;
    color: var(--text);
    letter-spacing: -0.02em;
  }
  .nav-buttons {
    margin-left: auto;
    display: flex;
    gap: 0.35rem;
    align-items: center;
  }
  .nav-btn {
    background: var(--surface2);
    border: 1px solid var(--border);
    color: var(--text-mid);
    height: 36px;
    padding: 0 0.9rem;
    cursor: pointer;
    font-size: var(--fs-xs);
    font-family: 'Outfit', sans-serif;
    font-weight: 500;
    border-radius: var(--radius-sm);
    transition: all 0.15s;
    display: flex;
    align-items: center;
    gap: 0.3rem;
    white-space: nowrap;
  }
  .nav-btn:hover:not(:disabled) {
    border-color: var(--accent);
    color: var(--accent);
    background: var(--accent-dim);
  }
  .nav-btn:active:not(:disabled) { transform: scale(0.97); }
  .nav-btn:disabled { opacity: 0.2; cursor: default; }
  .song-counter {
    font-family: 'JetBrains Mono', monospace;
    font-size: var(--fs-label);
    color: var(--text-dim);
    padding: 0 0.5rem;
    white-space: nowrap;
  }

  @media (max-width: 900px) {
    .btn-label { display: none; }
    .nav-btn { padding: 0 0.7rem; }
  }
  @media (max-width: 700px) {
    .tanda-header { padding: 0.8rem 1rem; gap: 0.6rem; }
    .tanda-number-big { font-size: var(--fs-heading); }
    .tanda-title-block h2 { font-size: var(--fs-body); }
  }
  @media (max-width: 400px) {
    .tanda-header { flex-wrap: wrap; }
    .nav-buttons { width: 100%; justify-content: flex-end; margin-left: 0; }
  }
</style>
