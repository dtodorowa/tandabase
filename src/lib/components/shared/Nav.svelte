<script lang="ts">
  import AuthButton from './AuthButton.svelte';
  import { page } from '$app/state';
  import { authState } from '$lib/stores/auth.svelte';
  import { getFlagsForOwner } from '$lib/firebase/db';

  let flagCount = $state(0);
  let mobileOpen = $state(false);

  $effect(() => {
    if (authState.isLoggedIn && authState.user) {
      getFlagsForOwner(authState.user.uid)
        .then(flags => { flagCount = flags.length; })
        .catch(() => { flagCount = 0; });
    } else {
      flagCount = 0;
    }
  });

  // Close mobile nav on route change
  $effect(() => {
    page.url.pathname;
    mobileOpen = false;
  });
</script>

<nav class="nav">
  <div class="nav-left">
    <a href="/" class="logo">
      <span class="logo-text">tanda<span class="logo-accent">base</span></span>
      <span class="logo-sub">tango listening tool</span>
    </a>
  </div>
  <div class="nav-links desktop-links">
    <a href="/browse" class:active={page.url.pathname === '/browse'}>Browse</a>
    <a href="/create" class:active={page.url.pathname === '/create'}>Create</a>
    <a href="/import" class:active={page.url.pathname === '/import'}>Import</a>
    <a href="/my-sets" class:active={page.url.pathname === '/my-sets'}>My Sets</a>
    {#if authState.isLoggedIn}
      <a href="/notifications" class="notif-link" class:active={page.url.pathname === '/notifications'}>
        Notifications
        {#if flagCount > 0}
          <span class="notif-badge">{flagCount}</span>
        {/if}
      </a>
    {/if}
    <a href="/about" class:active={page.url.pathname === '/about'}>About</a>
  </div>
  <div class="nav-right">
    <AuthButton />
    <button class="hamburger" onclick={() => mobileOpen = !mobileOpen} aria-label="Menu">
      {#if mobileOpen}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      {:else}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      {/if}
    </button>
  </div>
</nav>

{#if mobileOpen}
  <div class="mobile-backdrop" onclick={() => mobileOpen = false} role="presentation"></div>
  <div class="mobile-drawer">
    <a href="/browse" class:active={page.url.pathname === '/browse'}>Browse</a>
    <a href="/create" class:active={page.url.pathname === '/create'}>Create</a>
    <a href="/import" class:active={page.url.pathname === '/import'}>Import</a>
    <a href="/my-sets" class:active={page.url.pathname === '/my-sets'}>My Sets</a>
    {#if authState.isLoggedIn}
      <a href="/notifications" class="notif-link" class:active={page.url.pathname === '/notifications'}>
        Notifications
        {#if flagCount > 0}
          <span class="notif-badge">{flagCount}</span>
        {/if}
      </a>
    {/if}
    <a href="/about" class:active={page.url.pathname === '/about'}>About</a>
    <div class="mobile-auth">
      <AuthButton />
    </div>
  </div>
{/if}

<style>
  .nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.8rem 1.5rem;
    border-bottom: 1px solid var(--border);
    background: var(--surface);
    height: 56px;
    position: relative;
    z-index: 50;
  }
  .nav-left {
    display: flex;
    align-items: center;
  }
  .logo {
    text-decoration: none;
    display: flex;
    flex-direction: column;
  }
  .logo-text {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text);
    letter-spacing: -0.02em;
  }
  .logo-accent { color: var(--accent); }
  .logo-sub {
    font-size: 0.65rem;
    color: var(--text-dim);
    letter-spacing: 0.06em;
    font-weight: 400;
  }
  .nav-links {
    display: flex;
    gap: 1.5rem;
  }
  .nav-links a {
    font-size: 1rem;
    font-weight: 500;
    color: var(--text-mid);
    transition: color 0.15s;
  }
  .nav-links a:hover, .nav-links a.active {
    color: var(--accent);
  }
  .nav-right {
    display: flex;
    align-items: center;
  }

  .notif-link {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
  }
  .notif-badge {
    background: var(--tango);
    color: #fff;
    font-size: 0.52rem;
    font-weight: 700;
    min-width: 15px;
    height: 15px;
    border-radius: 99px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 0.25rem;
    line-height: 1;
  }

  .hamburger {
    display: none;
    background: none;
    border: 1px solid var(--border);
    color: var(--text-mid);
    width: 34px;
    height: 34px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    align-items: center;
    justify-content: center;
    margin-left: 0.5rem;
    transition: all 0.12s;
  }
  .hamburger:hover { border-color: var(--accent); color: var(--accent); }

  .mobile-backdrop {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.5);
    z-index: 90;
  }
  .mobile-drawer {
    display: none;
    position: fixed;
    top: 56px;
    right: 0;
    bottom: 0;
    width: 240px;
    background: var(--surface);
    border-left: 1px solid var(--border);
    z-index: 100;
    flex-direction: column;
    padding: 1rem 0;
    overflow-y: auto;
  }
  .mobile-drawer a {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.65rem 1.2rem;
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--text-mid);
    text-decoration: none;
    transition: all 0.12s;
  }
  .mobile-drawer a:hover, .mobile-drawer a.active {
    color: var(--accent);
    background: var(--accent-dim);
  }
  .mobile-auth {
    padding: 0.8rem 1.2rem;
    margin-top: auto;
    border-top: 1px solid var(--border);
  }

  @media (max-width: 700px) {
    .desktop-links { display: none; }
    .hamburger { display: flex; }
    .mobile-backdrop { display: block; }
    .mobile-drawer { display: flex; }
    .nav { padding: 0.8rem 1rem; }
    .nav-right :global(.auth-button) {
      display: none;
    }
  }

  @media (min-width: 701px) {
    .nav-links { gap: 1.5rem; }
  }
</style>
