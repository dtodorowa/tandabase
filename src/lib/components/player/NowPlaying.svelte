<script lang="ts">
  import { player } from '$lib/stores/player.svelte';
</script>

{#if player.currentSong && player.currentTanda}
  <div class="now-playing">
    <div class="np-title">{player.currentSong.title}</div>
    <div class="np-meta">
      {player.currentTanda.orchestra}
      {player.currentSong.singer ? ` \u00b7 ${player.currentSong.singer}` : ''}
      {player.currentSong.year ? ` \u00b7 ${player.currentSong.year}` : ''}
      &middot; {player.currentTanda.genre}
    </div>
  </div>
{/if}

<style>
  .now-playing { text-align: center; max-width: 500px; }
  .np-title {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 1.05rem;
    font-weight: 600;
    color: var(--text);
  }
  .np-meta {
    font-size: 0.72rem;
    color: var(--text-dim);
    margin-top: 0.2rem;
  }
</style>
