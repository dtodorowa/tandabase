<script lang="ts">
  import AuthButton from './AuthButton.svelte';
  import { page } from '$app/state';
  import { authState } from '$lib/stores/auth.svelte';
  import { getFlagsForOwner } from '$lib/firebase/db';

  let flagCount = $state(0);
  let mobileOpen = $state(false);
  let profileOpen = $state(false);

  $effect(() => {
    if (authState.isLoggedIn && authState.user) {
      getFlagsForOwner(authState.user.uid)
        .then(flags => { flagCount = flags.length; })
        .catch(() => { flagCount = 0; });
    } else {
      flagCount = 0;
    }
  });

  // Close menus on route change
  $effect(() => {
    page.url.pathname;
    mobileOpen = false;
    profileOpen = false;
  });
</script>

<nav class="nav">
  <div class="nav-left">
    <!-- Mobile: profile pic -->
    <div class="mobile-avatar">
      {#if !authState.isLoggedIn}
     
      {:else if authState.isLoggedIn && authState.user?.photoURL}
        <a href="/my-sets"><img src={authState.user.photoURL} alt="" class="mobile-avatar-img" /></a>
      {:else if authState.isLoggedIn}
        <a href="/my-sets" class="mobile-avatar-placeholder">{authState.user?.displayName?.charAt(0).toUpperCase() ?? 'U'}</a>
      {:else}
        <button class="mobile-avatar-placeholder" onclick={() => authState.signInWithGoogle()}>?</button>
      {/if}
    </div>

    <!-- Desktop: logo + primary links -->
    <a href="/" class="logo desktop-logo">
      <span class="logo-text">tanda<span class="logo-accent">base</span></span>
    </a>

    <div class="primary-links desktop-only">
      <a href="/browse" class:active={page.url.pathname === '/browse'}>Browse</a>
      {#if authState.isLoggedIn}
        <a href="/create" class:active={page.url.pathname === '/create'}>Create</a>
        <a href="/import" class:active={page.url.pathname === '/import'}>Import</a>
        <a href="/my-sets" class:active={page.url.pathname === '/my-sets'}>My Sets</a>
      {/if}
      <a href="/about" class:active={page.url.pathname === '/about'}>About</a>
    </div>
  </div>

  <!-- Mobile: centered logo -->
    <a href="/" class="logo mobile-logo">
      <span class="logo-text">tanda<span class="logo-accent">base</span></span>
    </a>


  <div class="nav-right">
    <!-- Desktop: notification bell + profile dropdown -->
    {#if authState.isLoggedIn}
      <a href="/notifications" class="notif-bell desktop-only" aria-label="Notifications">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
        {#if flagCount > 0}
          <span class="notif-dot"></span>
        {/if}
      </a>
    {/if}

    <div class="profile-menu desktop-only">
      {#if authState.isLoggedIn}
        <button class="profile-trigger" onclick={() => profileOpen = !profileOpen}>
          {#if authState.user?.photoURL}
            <img src={authState.user.photoURL} alt="" class="avatar" />
          {:else}
            <span class="avatar avatar-fallback">{authState.user?.displayName?.charAt(0).toUpperCase() ?? 'U'}</span>
          {/if}
          <span class="profile-name">{authState.user?.displayName ?? 'User'}</span>
          <svg class="chevron" class:open={profileOpen} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>

        {#if profileOpen}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div class="dropdown-backdrop" onclick={() => profileOpen = false}></div>
          <div class="dropdown">
            <a href="/my-sets" class="dropdown-item">My Sets</a>
            <!-- <a href="/about" class="dropdown-item">About Tandabase</a> -->
            <div class="dropdown-divider"></div>
            <button class="dropdown-item text-danger" onclick={() => { authState.logout(); profileOpen = false; }}>Sign out</button>
          </div>
        {/if}
      {:else}
        <button class="sign-in-btn" onclick={() => authState.signInWithGoogle()}>Sign in</button>
      {/if}
    </div>

    <!-- Mobile: hamburger -->
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
    {#if authState.isLoggedIn}
      <a href="/create" class:active={page.url.pathname === '/create'}>Create</a>
      <a href="/import" class:active={page.url.pathname === '/import'}>Import</a>
      <a href="/my-sets" class:active={page.url.pathname === '/my-sets'}>My Sets</a>
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
    padding: 0 2rem;
    border-bottom: 1px solid var(--border);
    background: var(--bg);
    height: 56px;
    position: relative;
    z-index: 50;
  }

  /* ── Left: logo + primary links ── */
  .nav-left {
    display: flex;
    align-items: center;
    gap: 3rem;
  }
  .logo {
    text-decoration: none;
    display: flex;
    align-items: baseline;
  }
  .mobile-logo { display: none; }
  .logo-text {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 1.35rem;
    font-weight: 600;
    color: var(--text);
    letter-spacing: -0.02em;
  }
  .logo-accent { color: var(--accent); }

  .primary-links {
    display: flex;
    gap: 1.5rem;
  }
  .primary-links a {
    font-size: var(--fs-sm);
    font-weight: 500;
    color: var(--text-dim);
    text-decoration: none;
    transition: color 0.15s;
  }
  .primary-links a:hover { color: var(--text); }
  .primary-links a.active { color: var(--text); }

  /* ── Right: bell + profile ── */
  .nav-right {
    display: flex;
    align-items: center;
    gap: 1.2rem;
  }

  /* Notification bell */
  .notif-bell {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    color: var(--text-dim);
    transition: background 0.15s, color 0.15s;
    text-decoration: none;
  }
  .notif-bell:hover { background: var(--surface2); color: var(--text); }
  .notif-dot {
    position: absolute;
    top: 6px;
    right: 7px;
    width: 7px;
    height: 7px;
    background: var(--tango);
    border-radius: 50%;
    border: 2px solid var(--bg);
  }

  /* Profile dropdown */
  .profile-menu { position: relative; }
  .profile-trigger {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--text-dim);
    font-size: var(--fs-sm);
    font-weight: 500;
    font-family: 'Outfit', sans-serif;
    padding: 0.25rem 0.5rem;
    border-radius: var(--radius-sm);
    transition: background 0.15s, color 0.15s;
  }
  .profile-trigger:hover { background: var(--surface2); color: var(--text); }

  .avatar {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    object-fit: cover;
    border: 1px solid var(--border);
  }
  .avatar-fallback {
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--accent-dim);
    color: var(--accent);
    font-size: 0.75rem;
    font-weight: 600;
  }
  .profile-name {
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .chevron {
    opacity: 0.5;
    transition: transform 0.2s;
    flex-shrink: 0;
  }
  .chevron.open { transform: rotate(180deg); }

  .dropdown-backdrop {
    position: fixed;
    inset: 0;
    z-index: 99;
  }
  .dropdown {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    width: 200px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    z-index: 100;
    overflow: hidden;
  }
  .dropdown-item {
    display: block;
    width: 100%;
    padding: 0.65rem 1rem;
    background: none;
    border: none;
    color: var(--text-dim);
    font-size: var(--fs-sm);
    font-family: 'Outfit', sans-serif;
    text-decoration: none;
    text-align: left;
    cursor: pointer;
    transition: background 0.12s, color 0.12s;
  }
  .dropdown-item:hover { background: var(--surface2); color: var(--text); }
  .dropdown-divider {
    height: 1px;
    background: var(--border);
    margin: 0.2rem 0;
  }
  .text-danger { color: var(--tango) !important; }
  .text-danger:hover { background: rgba(248,113,113,0.08) !important; }

  .sign-in-btn {
    background: var(--accent);
    border: 1px solid var(--accent);
    color: var(--bg);
    padding: 0.35rem 0.9rem;
    font-size: var(--fs-xs);
    font-weight: 600;
    font-family: 'Outfit', sans-serif;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all 0.15s;
  }
  .sign-in-btn:hover { background: var(--accent-bright); border-color: var(--accent-bright); }

  /* ── Mobile hamburger ── */
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
    transition: all 0.12s;
  }
  .hamburger:hover { border-color: var(--accent); color: var(--accent); }

  /* ── Mobile drawer ── */
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
    font-size: var(--fs-sm);
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
  .notif-link {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
  }
  .notif-badge {
    background: var(--tango);
    color: #fff;
    font-size: var(--fs-micro);
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

  /* ── Mobile avatar (hidden on desktop) ── */
  .mobile-avatar { display: none; }
  .mobile-avatar-img {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 1px solid var(--border);
    object-fit: cover;
  }
  .mobile-avatar-placeholder {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--accent-dim);
    color: var(--accent);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.7rem;
    font-weight: 600;
    border: 1px solid var(--border);
    text-decoration: none;
    cursor: pointer;
  }

  /* ── Desktop-only / mobile toggle ── */
  .desktop-only { display: flex; }

  @media (max-width: 700px) {
    .desktop-only { display: none !important; }
    .hamburger { display: flex; }
    .mobile-backdrop { display: block; }
    .mobile-drawer { display: flex; }
    .nav {
      padding: 0 1rem;
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: center;
    }
    .nav-left { justify-content: flex-start; }
    .desktop-logo { display: none; }
    .mobile-avatar { display: flex; }
    .mobile-logo { display: flex; justify-content: center; }
    .nav-right { justify-content: flex-end; }
  }
</style>
