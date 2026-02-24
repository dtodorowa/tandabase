<script lang="ts">
  import { authState } from '$lib/stores/auth.svelte';
</script>

<svelte:head>
  <title>Practica Set</title>
</svelte:head>

<div class="home">
  <div class="hero">
    <h1>tanda<span class="accent">base</span></h1>
    <p class="tagline">Browse and share tango setlists</p>
    <p class="subtitle">
       (Because YouTube playlists weren't cutting it)
    </p>
    <div class="cta-row">
      <a href="/browse" class="btn primary">Browse Sets</a>
      <a href="/create" class="btn secondary">Create a Set</a>
    </div>
  </div>

  {#if authState.isLoggedIn}
    <div class="welcome">
      <p>Welcome back, {authState.user?.displayName ?? 'dancer'}!</p>
      <a href="/my-sets" class="btn small">Your Sets &rarr;</a>
    </div>
  {/if}
</div>

<style>
  .home {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: calc(100vh - 56px);
    padding: 2rem;
    text-align: center;
  }
  .hero {
    max-width: 600px;
  }
  .hero h1 {
    font-family: 'Space Grotesk', sans-serif;
    font-size: var(--fs-hero);
    font-weight: 700;
    letter-spacing: -0.03em;
    margin-bottom: 0.5rem;
  }
  .accent { color: var(--accent); }
  .tagline {
    font-size: var(--fs-subheading);
    color: var(--text-mid);
    margin-bottom: 0.5rem;
  }
  .subtitle {
    font-size: var(--fs-sm);
    color: var(--text-dim);
    margin-bottom: 2rem;
    line-height: 1.5;
  }
  .cta-row {
    display: flex;
    gap: 0.75rem;
    justify-content: center;
    flex-wrap: wrap;
  }
  .btn {
    display: inline-flex;
    align-items: center;
    padding: 0.65rem 1.5rem;
    border-radius: var(--radius);
    font-size: var(--fs-sm);
    font-weight: 600;
    text-decoration: none;
    transition: all 0.15s;
    font-family: 'Outfit', sans-serif;
  }
  .btn.primary {
    background: var(--accent);
    color: var(--bg);
  }
  .btn.primary:hover { background: var(--accent-bright); }
  .btn.secondary {
    background: var(--surface2);
    border: 1px solid var(--border);
    color: var(--text-mid);
  }
  .btn.secondary:hover {
    border-color: var(--accent);
    color: var(--accent);
  }
  .btn.small {
    padding: 0.4rem 1rem;
    font-size: var(--fs-xs);
  }
  .welcome {
    margin-top: 2.5rem;
    padding: 1.25rem 2rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  .welcome p {
    font-size: var(--fs-sm);
    color: var(--text-mid);
  }
</style>
