<script lang="ts">
  import { page } from '$app/state';
  import { authState } from '$lib/stores/auth.svelte';
  import { getFlagsForOwner } from '$lib/firebase/db';
  import { themeState } from '$lib/stores/theme.svelte';
  import { Sun, Moon, Menu, X, Bell, ChevronDown } from 'lucide-svelte';

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

  const navLinks = [
    // { href: '/', label: 'Home' },
    { href: '/browse', label: 'Listen' },
    { href: '/create', label: 'Create' },
    // { href: '/about', label: 'About' },
  ];
</script>

<nav class="fixed top-0 inset-x-0 w-full z-40 flex justify-between items-center px-6 md:px-16 py-4 bg-surface/80 dark:bg-background/80 backdrop-blur-md border-b border-black/5 dark:border-white/5 transition-all duration-300">
  <!-- Logo -->
  <a href="/" class="font-serif text-3xl italic tracking-tight text-ink no-underline">
    tandabase
  </a>

  <!-- Desktop nav links -->
  <div class="hidden md:flex gap-12 font-sans text-xs uppercase tracking-[0.15em] font-medium">
    {#each navLinks as link (link.href)}
      <a
        href={link.href}
        class="transition-colors no-underline {page.url.pathname === link.href ? 'text-ink' : 'text-ink-muted hover:text-ink'}"
      >
        {link.label}
      </a>
    {/each}
    {#if authState.isLoggedIn}
      <!-- <a
        href="/import"
        class="transition-colors no-underline {page.url.pathname === '/import' ? 'text-ink' : 'text-ink-muted hover:text-ink'}"
      >
        Import
      </a> -->
      <a
        href="/my-sets"
        class="transition-colors no-underline {page.url.pathname === '/my-sets' ? 'text-ink' : 'text-ink-muted hover:text-ink'}"
      >
        My Sets
      </a>
    {/if}
  </div>

  <!-- Right side: theme toggle + profile -->
  <div class="flex items-center gap-4">
    <!-- Theme toggle -->
    <button
      onclick={() => themeState.toggle()}
      aria-label="Toggle theme"
      class="hidden md:flex w-10 h-10 items-center justify-center rounded-full border border-black/10 dark:border-white/10 text-ink-muted hover:text-ink hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
    >
      {#if themeState.current === 'dark'}
        <Sun class="w-4 h-4" />
      {:else}
        <Moon class="w-4 h-4" />
      {/if}
    </button>

    <!-- Notification bell -->
    {#if authState.isLoggedIn}
      <a href="/notifications" class="hidden md:flex relative w-10 h-10 items-center justify-center rounded-full text-ink-muted hover:text-ink hover:bg-black/5 dark:hover:bg-white/5 transition-colors no-underline">
        <Bell class="w-4 h-4" />
        {#if flagCount > 0}
          <span class="absolute top-1.5 right-1.5 w-2 h-2 bg-tango rounded-full border-2 border-surface"></span>
        {/if}
      </a>
    {/if}

    <!-- Profile area -->
    {#if authState.isLoggedIn}
      <div class="relative hidden md:block">
        <button
          onclick={() => profileOpen = !profileOpen}
          class="flex items-center gap-3 cursor-pointer bg-transparent border-none"
        >
          <span class="text-xs font-medium uppercase tracking-[0.15em] text-ink-muted">
            {authState.user?.displayName ?? 'User'}
          </span>
          <div class="w-10 h-10 rounded-full bg-ink/10 dark:bg-white/10 overflow-hidden border border-black/10 dark:border-white/10">
            {#if authState.user?.photoURL}
              <img src={authState.user.photoURL} alt="Profile" class="w-full h-full object-cover" />
            {:else}
              <span class="w-full h-full flex items-center justify-center text-sm font-semibold text-ink-muted">
                {authState.user?.displayName?.charAt(0).toUpperCase() ?? 'U'}
              </span>
            {/if}
          </div>
          <ChevronDown class="w-3 h-3 text-ink-muted transition-transform {profileOpen ? 'rotate-180' : ''}" />
        </button>

        {#if profileOpen}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div class="fixed inset-0 z-99" onclick={() => profileOpen = false}></div>
          <div class="absolute top-full right-0 mt-2 w-52 bg-card border border-border rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.12)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.4)] z-100 overflow-hidden">
            <a href="/my-sets" class="block px-4 py-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors no-underline">My Sets</a>
            <a href="/notifications" class="block px-4 py-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors no-underline">
              Notifications
              {#if flagCount > 0}
                <span class="ml-2 px-1.5 py-0.5 text-[10px] font-bold bg-tango text-white rounded-full">{flagCount}</span>
              {/if}
            </a>
            <div class="h-px bg-border mx-2"></div>
            <button
              class="block w-full text-left px-4 py-3 text-sm text-tango hover:bg-tango/5 transition-colors cursor-pointer border-none bg-transparent font-sans"
              onclick={() => { authState.logout(); profileOpen = false; }}
            >
              Sign out
            </button>
          </div>
        {/if}
      </div>
    {:else}
      <button
        class="hidden md:inline-flex items-center justify-center px-6 py-2.5 text-xs font-medium tracking-wide text-primary-foreground bg-primary rounded-full transition-transform active:scale-95 cursor-pointer border-none"
        onclick={() => authState.signInWithGoogle()}
      >
        Sign in
      </button>
    {/if}

    <!-- Mobile hamburger -->
    <button
      class="md:hidden flex w-10 h-10 items-center justify-center rounded-full border border-black/10 dark:border-white/10 text-ink-muted hover:text-ink transition-colors cursor-pointer bg-transparent"
      onclick={() => mobileOpen = !mobileOpen}
      aria-label="Menu"
    >
      {#if mobileOpen}
        <X class="w-5 h-5" />
      {:else}
        <Menu class="w-5 h-5" />
      {/if}
    </button>
  </div>
</nav>

<!-- Mobile drawer -->
{#if mobileOpen}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="fixed inset-0 bg-black/20 z-90 md:hidden" onclick={() => mobileOpen = false}></div>
  <div class="fixed top-0 right-0 bottom-0 w-72 bg-card dark:bg-card border-l border-border z-100 md:hidden flex flex-col pt-24 pb-6 px-6 overflow-y-auto shadow-2xl">

    <div class="flex flex-col gap-1 mb-8">
      {#each navLinks as link}
        <a
          href={link.href}
          class="py-3 px-4 rounded-lg text-sm font-medium no-underline transition-colors {page.url.pathname === link.href ? 'text-ink bg-black/5 dark:bg-white/5' : 'text-ink-muted hover:text-ink hover:bg-black/5 dark:hover:bg-white/5'}"
        >
          {link.label}
        </a>
      {/each}
      {#if authState.isLoggedIn}
        <!-- <a href="/import" class="py-3 px-4 rounded-lg text-sm font-medium text-ink-muted hover:text-ink hover:bg-black/5 dark:hover:bg-white/5 no-underline transition-colors">Import</a> -->
        <a href="/my-sets" class="py-3 px-4 rounded-lg text-sm font-medium text-ink-muted hover:text-ink hover:bg-black/5 dark:hover:bg-white/5 no-underline transition-colors">My Sets</a>
        <a href="/notifications" class="py-3 px-4 rounded-lg text-sm font-medium text-ink-muted hover:text-ink hover:bg-black/5 dark:hover:bg-white/5 no-underline transition-colors">
          Notifications
          {#if flagCount > 0}
            <span class="ml-2 px-1.5 py-0.5 text-[10px] font-bold bg-tango text-white rounded-full">{flagCount}</span>
          {/if}
        </a>
      {/if}
    </div>

    <div class="border-t border-border pt-6 mt-auto flex flex-col gap-3">
      <button
        class="flex items-center gap-3 py-3 px-4 rounded-lg text-sm font-medium text-ink-muted hover:text-ink hover:bg-black/5 dark:hover:bg-white/5 transition-colors w-full cursor-pointer bg-transparent border-none font-sans"
        onclick={() => themeState.toggle()}
      >
        {#if themeState.current === 'dark'}
          <Sun class="w-4 h-4" /> Light mode
        {:else}
          <Moon class="w-4 h-4" /> Dark mode
        {/if}
      </button>

      {#if authState.isLoggedIn}
        <button
          class="flex items-center gap-3 py-3 px-4 rounded-lg text-sm font-medium text-tango hover:bg-tango/5 transition-colors w-full cursor-pointer bg-transparent border-none font-sans"
          onclick={() => { authState.logout(); mobileOpen = false; }}
        >
          Sign out
        </button>
      {:else}
        <button
          class="w-full py-3 px-4 rounded-full text-sm font-medium text-primary-foreground bg-primary transition-colors cursor-pointer border-none font-sans"
          onclick={() => authState.signInWithGoogle()}
        >
          Sign in with Google
        </button>
      {/if}
    </div>
  </div>
{/if}
