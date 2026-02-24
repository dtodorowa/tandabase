<script lang="ts">
  import type { Genre } from '$lib/types';

  let { genre, size = 'sm' }: { genre: Genre; size?: 'sm' | 'md' } = $props();

  const colors: Record<Genre, string> = {
    Tango: 'var(--tango)',
    Milonga: 'var(--milonga)',
    Vals: 'var(--vals)',
  };

  const bgs: Record<Genre, string> = {
    Tango: 'rgba(248,113,113,0.1)',
    Milonga: 'rgba(96,165,250,0.1)',
    Vals: 'rgba(74,222,128,0.1)',
  };
</script>

<span
  class="genre-badge {size}"
  style="background: {bgs[genre]}; color: {colors[genre]};"
>
  <span class="genre-dot" style="background: {colors[genre]};"></span>
  {genre}
</span>

<style>
  .genre-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    border-radius: 4px;
  }
  .genre-badge.sm {
    font-size: var(--fs-micro);
    padding: 0.1rem 0.4rem;
  }
  .genre-badge.md {
    font-size: var(--fs-micro);
    padding: 0.2rem 0.55rem;
  }
  .genre-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    flex-shrink: 0;
  }
</style>
