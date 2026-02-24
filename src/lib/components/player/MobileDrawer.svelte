<script lang="ts">
  import type { Tanda } from '$lib/types';
  import Sidebar from './Sidebar.svelte';

  let { tandas, open = false, onclose }: { tandas: Tanda[]; open?: boolean; onclose: () => void } = $props();
</script>

<!-- Overlay: pointer-events: none when hidden, auto when visible (bug fix from prototype) -->
<div
  class="overlay"
  class:visible={open}
  onclick={onclose}
  onkeydown={onclose}
  role="button"
  tabindex="-1"
  aria-label="Close sidebar"
></div>

<nav class="sidebar" class:open>
  <button class="sidebar-close" onclick={onclose} aria-label="Close">&times;</button>
  <Sidebar {tandas} {onclose} />
</nav>

<style>
  .overlay {
    display: block;
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.65);
    z-index: 90;
    opacity: 0;
    transition: opacity 0.2s;
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    pointer-events: none;
  }
  .overlay.visible {
    opacity: 1;
    pointer-events: auto;
  }
  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    z-index: 100;
    width: 280px;
    background: var(--surface);
    border-right: 1px solid var(--border);
    overflow-y: auto;
    transform: translateX(-100%);
    transition: transform 0.25s cubic-bezier(0.4,0,0.2,1);
    box-shadow: none;
    padding-top: 2.5rem;
    scrollbar-width: thin;
    scrollbar-color: var(--border) transparent;
  }
  .sidebar::-webkit-scrollbar { width: 3px; }
  .sidebar::-webkit-scrollbar-track { background: transparent; }
  .sidebar::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
  .sidebar.open {
    transform: translateX(0);
    box-shadow: 8px 0 32px rgba(0,0,0,0.5);
  }
  .sidebar-close {
    display: flex;
    position: absolute;
    top: 0.6rem;
    right: 0.6rem;
    background: var(--surface2);
    border: 1px solid var(--border);
    color: var(--text-mid);
    width: 28px;
    height: 28px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-size: 0.9rem;
    z-index: 10;
    align-items: center;
    justify-content: center;
  }
</style>
