<script lang="ts">
  import { editor } from '$lib/stores/editor.svelte';
  import { authState } from '$lib/stores/auth.svelte';
  import { goto } from '$app/navigation';
  import TandaEditor from './TandaEditor.svelte';

  let expandedTandaId = $state<string | null>(null);
  let dragTandaIdx = $state<number | null>(null);
  let dragOverTandaIdx = $state<number | null>(null);

  async function handleSave() {
    if (!authState.user) return;
    const id = await editor.save(
      authState.user.uid,
      authState.user.displayName ?? 'Anonymous'
    );
    goto(`/set/${id}`);
  }

  function toggleTanda(id: string) {
    expandedTandaId = expandedTandaId === id ? null : id;
  }

  function handleTandaDragStart(idx: number) {
    dragTandaIdx = idx;
  }
  function handleTandaDragOver(e: DragEvent, idx: number) {
    e.preventDefault();
    dragOverTandaIdx = idx;
  }
  function handleTandaDrop(idx: number) {
    if (dragTandaIdx !== null && dragTandaIdx !== idx) {
      editor.reorderTandas(dragTandaIdx, idx);
      if (expandedTandaId) {
        expandedTandaId = expandedTandaId;
      }
    }
    dragTandaIdx = null;
    dragOverTandaIdx = null;
  }
  function handleTandaDragEnd() {
    dragTandaIdx = null;
    dragOverTandaIdx = null;
  }
</script>

<!-- Sticky save bar -->
<div class="sticky-bar">
  <div class="sticky-left">
    <h2 class="sticky-title">{editor.title || 'Untitled Set'}</h2>
    <span class="sticky-meta">{editor.tandaCount} tandas &middot; {editor.songCount} songs</span>
  </div>
  <button class="btn-save" onclick={handleSave} disabled={editor.saving || !editor.title}>
    {editor.saving ? 'Saving...' : 'Save Set'}
  </button>
</div>

<div class="editor-container">
  <!-- Set metadata -->
  <div class="editor-meta">
    <input
      type="text"
      bind:value={editor.title}
      placeholder="Set title"
      class="title-input"
    />
    <textarea
      bind:value={editor.description}
      placeholder="Description (optional)"
      class="desc-input"
      rows="2"
    ></textarea>
    <div class="cover-row">
      <input
        type="text"
        bind:value={editor.cover_image}
        placeholder="Cover image URL (optional)"
        class="cover-input"
      />
      {#if editor.cover_image}
        <img src={editor.cover_image} alt="Cover preview" class="cover-preview" />
      {/if}
    </div>
    <div class="meta-row">
      <div class="visibility-toggle">
        <button
          class="toggle-btn"
          class:is-public={editor.visibility === 'public'}
          onclick={() => editor.visibility = editor.visibility === 'public' ? 'private' : 'public'}
          type="button"
        >
          <span class="toggle-track">
            <span class="toggle-thumb"></span>
          </span>
          <span class="toggle-label">
            {editor.visibility === 'public' ? '🌐 Public' : '🔒 Private'}
          </span>
        </button>
        <span class="toggle-desc">
          {editor.visibility === 'public'
            ? 'Anyone can find and view this set'
            : 'Only you can see this set'}
        </span>
      </div>
    </div>
  </div>

  <!-- Tanda list -->
  <div class="tandas-list">
    {#each editor.tandas as tanda, i (tanda.id)}
      <div
        class="tanda-drop-zone"
        class:drag-over={dragOverTandaIdx === i && dragTandaIdx !== i}
        ondragover={(e) => handleTandaDragOver(e, i)}
        ondrop={() => handleTandaDrop(i)}
      >
        <TandaEditor
          {tanda}
          expanded={expandedTandaId === tanda.id}
          ontoggle={() => toggleTanda(tanda.id)}
          ondragstart={() => handleTandaDragStart(i)}
          ondragend={handleTandaDragEnd}
        />
      </div>
    {/each}
  </div>

  <button class="add-tanda-btn" onclick={() => editor.addTanda()}>+ Add Tanda</button>
</div>

<style>
  /* Sticky save bar */
  .sticky-bar {
    position: sticky;
    top: 0;
    background: rgba(9, 9, 11, 0.92);
    backdrop-filter: blur(8px);
    border-bottom: 1px solid var(--border);
    padding: 0.75rem 2rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    z-index: 100;
  }
  .sticky-left {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
  }
  .sticky-title {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text);
    margin: 0;
  }
  .sticky-meta {
    font-size: var(--fs-2xs);
    color: var(--text-dim);
  }
  .btn-save {
    background: var(--accent);
    color: var(--bg);
    border: none;
    padding: 0.5rem 1.2rem;
    border-radius: var(--radius-sm);
    font-size: var(--fs-sm);
    font-weight: 600;
    font-family: 'Outfit', sans-serif;
    cursor: pointer;
    transition: all 0.15s;
  }
  .btn-save:hover:not(:disabled) { background: var(--accent-bright); }
  .btn-save:disabled { opacity: 0.5; cursor: default; }

  /* Editor container */
  .editor-container {
    max-width: 900px;
    margin: 0 auto;
    padding: 1.5rem 1rem 3rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  /* Set metadata */
  .editor-meta {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 1rem;
  }
  .title-input {
    font-size: var(--fs-lead);
    font-weight: 600;
    background: transparent;
    border: 1px solid transparent;
    color: var(--text);
    border-radius: var(--radius-sm);
    padding: 0.5rem 0.6rem;
    font-family: 'Space Grotesk', sans-serif;
  }
  .title-input:focus { background: var(--bg); border-color: var(--accent); outline: none; }
  .desc-input {
    font-size: var(--fs-sm);
    background: transparent;
    border: 1px solid transparent;
    color: var(--text);
    border-radius: var(--radius-sm);
    padding: 0.4rem 0.6rem;
    resize: vertical;
    font-family: 'Outfit', sans-serif;
  }
  .desc-input:focus { background: var(--bg); border-color: var(--accent); outline: none; }
  .cover-row {
    display: flex;
    gap: 0.6rem;
    align-items: flex-start;
  }
  .cover-input {
    flex: 1;
    font-size: var(--fs-xs);
    background: transparent;
    border: 1px solid transparent;
    color: var(--text);
    border-radius: var(--radius-sm);
    padding: 0.4rem 0.6rem;
    font-family: 'Outfit', sans-serif;
  }
  .cover-input:focus { background: var(--bg); border-color: var(--accent); outline: none; }
  .cover-preview {
    width: 80px;
    height: 50px;
    object-fit: cover;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    flex-shrink: 0;
  }
  .meta-row {
    padding-top: 0.3rem;
  }
  .visibility-toggle {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }
  .toggle-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    font-family: 'Outfit', sans-serif;
  }
  .toggle-track {
    width: 36px;
    height: 20px;
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: 999px;
    position: relative;
    transition: background 0.2s, border-color 0.2s;
  }
  .toggle-thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 14px;
    height: 14px;
    background: var(--text-dim);
    border-radius: 50%;
    transition: transform 0.2s, background 0.2s;
  }
  .is-public .toggle-track {
    background: var(--accent);
    border-color: var(--accent);
  }
  .is-public .toggle-thumb {
    transform: translateX(16px);
    background: var(--bg);
  }
  .toggle-label {
    font-size: var(--fs-xs);
    font-weight: 600;
    color: var(--text);
  }
  .toggle-desc {
    font-size: var(--fs-2xs);
    color: var(--text-dim);
    padding-left: 2.7rem;
  }

  /* Tanda list */
  .tandas-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .tanda-drop-zone {
    border-radius: var(--radius);
    transition: outline 0.15s;
  }
  .tanda-drop-zone.drag-over {
    outline: 2px dashed var(--accent);
    outline-offset: 2px;
  }

  /* Add tanda button */
  .add-tanda-btn {
    width: 100%;
    padding: 0.75rem;
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text-dim);
    border-radius: var(--radius);
    cursor: pointer;
    font-weight: 600;
    font-size: var(--fs-sm);
    font-family: 'Outfit', sans-serif;
    transition: all 0.15s;
  }
  .add-tanda-btn:hover { border-color: var(--accent); color: var(--accent); }
</style>