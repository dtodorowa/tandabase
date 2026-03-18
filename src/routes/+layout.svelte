<script lang="ts">
  import '../app.css';
  import Nav from '$lib/components/shared/Nav.svelte';
  import PlayerModal from '$lib/components/player/PlayerModal.svelte';
  import { themeState } from '$lib/stores/theme.svelte';
  import { onMount } from 'svelte';

  let { children } = $props();

  onMount(() => {
    themeState.init();
  });
</script>

<Nav />
{@render children()}
<PlayerModal />
