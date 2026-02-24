<script lang="ts">
  import '../app.css';
  import Nav from '$lib/components/shared/Nav.svelte';

  let { children } = $props();
</script>

<Nav />
{@render children()}
