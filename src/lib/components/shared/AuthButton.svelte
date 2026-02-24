<script lang="ts">
  import { authState } from '$lib/stores/auth.svelte';
</script>

{#if authState.loading}
  <button class="auth-btn" disabled>...</button>
{:else if authState.isLoggedIn}
  <div class="auth-user">
    {#if authState.user?.photoURL}
      <img src={authState.user.photoURL} alt="" class="auth-avatar" />
    {/if}
    <span class="auth-name">{authState.user?.displayName ?? 'User'}</span>
    <button class="auth-btn" onclick={() => authState.logout()}>Sign out</button>
  </div>
{:else}
  <button class="auth-btn primary" onclick={() => authState.signInWithGoogle()}>Sign in</button>
{/if}

<style>
  .auth-user {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .auth-avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 1px solid var(--border);
  }
  .auth-name {
    font-size: 0.75rem;
    color: var(--text-mid);
    max-width: 100px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .auth-btn {
    background: var(--surface2);
    border: 1px solid var(--border);
    color: var(--text-mid);
    padding: 0.35rem 0.75rem;
    font-size: 0.72rem;
    font-weight: 500;
    border-radius: var(--radius-sm);
    transition: all 0.15s;
  }
  .auth-btn:hover:not(:disabled) {
    border-color: var(--accent);
    color: var(--accent);
  }
  .auth-btn.primary {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--bg);
  }
  .auth-btn.primary:hover {
    background: var(--accent-bright);
    border-color: var(--accent-bright);
  }
  .auth-btn:disabled {
    opacity: 0.5;
    cursor: default;
  }
</style>
