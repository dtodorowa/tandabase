<script lang="ts">
  let { src, name = '', size = 28 }: { src?: string | null; name?: string; size?: number } = $props();

  const initials = $derived(
    name
      .split(' ')
      .map(w => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase()
  );
</script>

{#if src}
  <img {src} alt={name} class="avatar" style="width: {size}px; height: {size}px;" />
{:else}
  <div class="avatar placeholder" style="width: {size}px; height: {size}px; font-size: {size * 0.4}px;">
    {initials || '?'}
  </div>
{/if}

<style>
  .avatar {
    border-radius: 50%;
    border: 1px solid var(--border);
    object-fit: cover;
  }
  .placeholder {
    background: var(--surface3);
    color: var(--text-dim);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-family: 'Space Grotesk', sans-serif;
  }
</style>
