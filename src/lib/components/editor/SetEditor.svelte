<script lang="ts">
  import { editor } from '$lib/stores/editor.svelte';
  import { authState } from '$lib/stores/auth.svelte';
  import { goto } from '$app/navigation';
  import TandaEditor from './TandaEditor.svelte';

  async function handleSave() {
    if (!authState.user) return;
    const id = await editor.save(
      authState.user.uid,
      authState.user.displayName ?? 'Anonymous'
    );
    goto(`/set/${id}`);
  }
</script>

<div class="set-editor">
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
      <label class="visibility-toggle">
        <input
          type="checkbox"
          checked={editor.visibility === 'public'}
          onchange={() => editor.visibility = editor.visibility === 'public' ? 'private' : 'public'}
        />
        <span>{editor.visibility === 'public' ? 'Public' : 'Private'}</span>
      </label>
      <span class="meta-stats">
        {editor.tandaCount} tandas &middot; {editor.songCount} songs
      </span>
    </div>
  </div>

  <div class="tandas-list">
    {#each editor.tandas as tanda (tanda.id)}
      <TandaEditor {tanda} />
    {/each}
  </div>

  <div class="editor-actions">
    <button class="add-tanda-btn" onclick={() => editor.addTanda()}>+ Add Tanda</button>
    <button class="save-btn" onclick={handleSave} disabled={editor.saving || !editor.title}>
      {editor.saving ? 'Saving...' : 'Save Set'}
    </button>
  </div>
</div>

<style>
  .set-editor {
    max-width: 800px;
    margin: 0 auto;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }
  .editor-meta {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .title-input {
    font-size: var(--fs-subheading);
    font-family: 'Space Grotesk', sans-serif;
    font-weight: 600;
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--text);
    border-radius: var(--radius-sm);
    padding: 0.6rem 0.8rem;
  }
  .title-input:focus { border-color: var(--accent); outline: none; }
  .desc-input {
    font-size: var(--fs-sm);
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--text);
    border-radius: var(--radius-sm);
    padding: 0.5rem 0.75rem;
    resize: vertical;
    font-family: 'Outfit', sans-serif;
  }
  .desc-input:focus { border-color: var(--accent); outline: none; }
  .cover-row {
    display: flex;
    gap: 0.6rem;
    align-items: flex-start;
  }
  .cover-input {
    flex: 1;
    font-size: var(--fs-xs);
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--text);
    border-radius: var(--radius-sm);
    padding: 0.45rem 0.7rem;
    font-family: 'Outfit', sans-serif;
  }
  .cover-input:focus { border-color: var(--accent); outline: none; }
  .cover-preview {
    width: 80px;
    height: 50px;
    object-fit: cover;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    flex-shrink: 0;
  }
  .meta-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .visibility-toggle {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: var(--fs-xs);
    color: var(--text-mid);
    cursor: pointer;
  }
  .meta-stats {
    font-size: var(--fs-2xs);
    color: var(--text-dim);
    font-family: 'JetBrains Mono', monospace;
  }
  .tandas-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .editor-actions {
    display: flex;
    gap: 0.75rem;
    justify-content: center;
    padding-top: 0.5rem;
  }
  .add-tanda-btn {
    background: var(--surface2);
    border: 1px dashed var(--border);
    color: var(--text-mid);
    padding: 0.6rem 1.2rem;
    font-size: var(--fs-xs);
    font-weight: 500;
    border-radius: var(--radius);
    transition: all 0.15s;
    font-family: 'Outfit', sans-serif;
  }
  .add-tanda-btn:hover { border-color: var(--accent); color: var(--accent); }
  .save-btn {
    background: var(--accent);
    border: none;
    color: var(--bg);
    padding: 0.6rem 1.5rem;
    font-size: var(--fs-sm);
    font-weight: 600;
    border-radius: var(--radius);
    transition: all 0.15s;
    font-family: 'Outfit', sans-serif;
  }
  .save-btn:hover:not(:disabled) { background: var(--accent-bright); }
  .save-btn:disabled { opacity: 0.5; cursor: default; }
</style>
