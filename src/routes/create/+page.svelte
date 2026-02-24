<script lang="ts">
  import { authState } from '$lib/stores/auth.svelte';
  import { editor } from '$lib/stores/editor.svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { getSet } from '$lib/firebase/db';
  import SetEditor from '$lib/components/editor/SetEditor.svelte';

  let loading = $state(false);

  $effect(() => {
    if (!authState.loading && !authState.isLoggedIn) {
      goto('/');
    }
  });

  $effect(() => {
    const editId = page.url.searchParams.get('edit');
    if (editId) {
      loadExisting(editId);
    } else {
      editor.reset();
    }
  });

  async function loadExisting(id: string) {
    loading = true;
    try {
      const set = await getSet(id);
      if (set) {
        editor.loadExisting(set);
      }
    } catch (e) {
      console.error('Failed to load set for editing:', e);
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>{editor.setId ? 'Edit Set' : 'Create Set'} - Practica Set</title>
</svelte:head>

{#if authState.loading || loading}
  <div class="center-msg">Loading...</div>
{:else if authState.isLoggedIn}
  <SetEditor />
{/if}

<style>
  .center-msg {
    display: flex;
    align-items: center;
    justify-content: center;
    height: calc(100vh - 56px);
    color: var(--text-dim);
    font-size: var(--fs-sm);
  }
</style>
