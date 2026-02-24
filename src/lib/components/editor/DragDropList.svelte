<script lang="ts">
  import type { Snippet } from 'svelte';

  let { items, onreorder, children }: {
    items: any[];
    onreorder: (from: number, to: number) => void;
    children: Snippet<[any, number]>;
  } = $props();

  let dragIndex = $state<number | null>(null);
  let overIndex = $state<number | null>(null);

  function handleDragStart(index: number, e: DragEvent) {
    dragIndex = index;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
    }
  }

  function handleDragOver(index: number, e: DragEvent) {
    e.preventDefault();
    overIndex = index;
  }

  function handleDrop(index: number) {
    if (dragIndex !== null && dragIndex !== index) {
      onreorder(dragIndex, index);
    }
    dragIndex = null;
    overIndex = null;
  }

  function handleDragEnd() {
    dragIndex = null;
    overIndex = null;
  }
</script>

<div class="drag-list">
  {#each items as item, i}
    <div
      class="drag-item"
      class:dragging={dragIndex === i}
      class:over={overIndex === i && dragIndex !== i}
      draggable="true"
      ondragstart={(e) => handleDragStart(i, e)}
      ondragover={(e) => handleDragOver(i, e)}
      ondrop={() => handleDrop(i)}
      ondragend={handleDragEnd}
      role="listitem"
    >
      {@render children(item, i)}
    </div>
  {/each}
</div>

<style>
  .drag-list {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  .drag-item {
    transition: opacity 0.15s, transform 0.15s;
  }
  .drag-item.dragging {
    opacity: 0.4;
  }
  .drag-item.over {
    border-top: 2px solid var(--accent);
    padding-top: 2px;
  }
</style>
