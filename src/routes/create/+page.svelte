<script lang="ts">
  import { authState } from '$lib/stores/auth.svelte';
  import { editor } from '$lib/stores/editor.svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { getSet } from '$lib/firebase/db';
  import TandaBuilderPanel from '$lib/components/editor/TandaBuilderPanel.svelte';
  import ImportDialog from '$lib/components/editor/ImportDialog.svelte';
  import { Plus, Minus, Save, Eye, EyeOff, Trash2, X, CheckSquare, GripVertical, LogIn, FileDown, ArrowLeft, Upload } from 'lucide-svelte';
  import type { Tanda } from '$lib/types';
  import type { Genre } from '$lib/types';
  import { untrack } from 'svelte';

  let loading = $state(false);
  let openSlotIndex = $state<number | null>(null);
  let tandaCount = $state(4);
  let didInit = false;

  // ── Multi-select state ──
  let selectedTandas = $state<Set<string>>(new Set());
  let lastClickedIndex = $state<number | null>(null);
  let selectionMode = $state(false);

  let selectedCount = $derived(selectedTandas.size);

  // ── Hover popover state ──
  let hoveredIndex = $state<number | null>(null);
  let hoverTimer: ReturnType<typeof setTimeout> | null = null;
  let popoverPosition = $state<{ x: number; y: number } | null>(null);

  // ── Drag-and-drop state ──
  let dragIndex = $state<number | null>(null);
  let dragOverIndex = $state<number | null>(null);
  let dragOverPosition = $state<'before' | 'after'>('before');
  let dragOverBin = $state(false);

  function handleDragStart(index: number, event: DragEvent) {
    if (selectionMode) { event.preventDefault(); return; }
    dragIndex = index;
    dragOverIndex = null;
    dragOverBin = false;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(index));
    }
    // Dismiss any hover popover
    handleTandaMouseLeave();
  }

  function handleDragOver(index: number, event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    dragOverBin = false;

    // Determine if cursor is in left or right half of the card
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    dragOverPosition = event.clientX < midX ? 'before' : 'after';
    dragOverIndex = index;
  }

  function handleDrop(index: number, event: DragEvent) {
    event.preventDefault();
    if (dragIndex !== null && dragIndex !== index) {
      // Calculate the actual target index based on before/after position
      let targetIndex = dragOverPosition === 'after' ? index + 1 : index;
      // Adjust if dragging from before the target
      if (dragIndex < targetIndex) targetIndex--;
      if (targetIndex !== dragIndex) {
        editor.reorderTandas(dragIndex, targetIndex);
      }
    }
    dragIndex = null;
    dragOverIndex = null;
  }

  function handleDragEnd() {
    if (dragIndex !== null && dragOverBin) {
      // Dropped on the bin — delete
      const tanda = editor.tandas[dragIndex];
      if (tanda) {
        editor.removeTanda(tanda.id);
        tandaCount = editor.tandas.length;
      }
    }
    dragIndex = null;
    dragOverIndex = null;
    dragOverBin = false;
  }

  function handleBinDragOver(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    dragOverBin = true;
    dragOverIndex = null;
  }

  function handleBinDragLeave() {
    dragOverBin = false;
  }

  function handleBinDrop(event: DragEvent) {
    event.preventDefault();
    // deletion handled in handleDragEnd via dragOverBin flag
  }

  function handleTandaMouseEnter(index: number, event: MouseEvent) {
    const target = event.currentTarget as HTMLElement;
    if (hoverTimer) clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => {
      const rect = target.getBoundingClientRect();
      popoverPosition = {
        x: rect.left + rect.width / 2,
        y: rect.top,
      };
      hoveredIndex = index;
    }, 700);
  }

  function handleTandaMouseLeave() {
    if (hoverTimer) {
      clearTimeout(hoverTimer);
      hoverTimer = null;
    }
    hoveredIndex = null;
    popoverPosition = null;
  }

  // Auth guard removed — anyone can build a set.
  // Login is prompted at save time via signInWithPopup (no redirect, no data loss).

  $effect(() => {
    const editId = page.url.searchParams.get('edit');
    if (didInit) return;
    didInit = true;
    if (editId) {
      loadExisting(editId);
    } else {
      untrack(() => {
        editor.reset();
        syncTandaCount();
      });
    }
  });

  async function loadExisting(id: string) {
    loading = true;
    try {
      const set = await getSet(id);
      if (set) {
        editor.loadExisting(set);
        tandaCount = set.tandas.length;
      }
    } catch (e) {
      console.error('Failed to load set for editing:', e);
    } finally {
      loading = false;
    }
  }

  function syncTandaCount() {
    while (editor.tandas.length < tandaCount) {
      editor.addTanda();
    }
    while (editor.tandas.length > tandaCount) {
      const last = editor.tandas[editor.tandas.length - 1];
      if (last) editor.removeTanda(last.id);
    }
  }

  function adjustCount(delta: number) {
    const next = Math.max(1, Math.min(999, tandaCount + delta));
    if (next === tandaCount) return;
    tandaCount = next;
    syncTandaCount();
  }

  function getSlotSummary(index: number): {
    orchestra: string; genre: Genre; songCount: number; filled: boolean;
    description: string; singerDisplay: string; yearRange: string; isInstrumental: boolean;
  } {
    const tanda = editor.tandas[index];
    if (!tanda) return { orchestra: '', genre: 'Tango', songCount: 0, filled: false, description: '', singerDisplay: '', yearRange: '', isInstrumental: false };

    // Collect unique singers and count instrumentals
    const singers = [...new Set(tanda.songs.map(s => s.singer).filter((s): s is string => !!s && s !== 'Instrumental' && s !== '-'))];
    const instrumentalCount = tanda.songs.filter(s => !s.singer || s.singer === 'Instrumental' || s.singer === '-').length;
    const hasInstrumentals = instrumentalCount > 0;
    const isInstrumental = singers.length === 0 && tanda.songs.length > 0;
    let singerDisplay = '';
    if (isInstrumental) {
      singerDisplay = 'Instrumental';
    } else if (hasInstrumentals && singers.length > 0) {
      // Mixed: some instrumental + some singers
      if (singers.length === 1) {
        singerDisplay = `Instr. + ${singers[0]}`;
      } else if (singers.length === 2) {
        singerDisplay = `Instr. + ${singers[0]} & ${singers[1]}`;
      } else {
        singerDisplay = `Instr. + ${singers[0]} & ${singers.length - 1} others`;
      }
    } else if (singers.length === 1) {
      singerDisplay = singers[0];
    } else if (singers.length === 2) {
      singerDisplay = `${singers[0]} & ${singers[1]}`;
    } else if (singers.length > 2) {
      singerDisplay = `${singers[0]} & ${singers.length - 1} others`;
    }

    // Year range
    const years = tanda.songs.map(s => s.year).filter((y): y is number => y !== null && y !== undefined);
    let yearRange = '';
    if (years.length > 0) {
      const minYear = Math.min(...years);
      const maxYear = Math.max(...years);
      yearRange = minYear === maxYear ? String(minYear) : `${minYear}–${maxYear}`;
    }

    return {
      orchestra: tanda.orchestra || '',
      genre: tanda.genre,
      songCount: tanda.songs.length,
      filled: tanda.songs.length > 0,
      description: tanda.description || '',
      singerDisplay,
      yearRange,
      isInstrumental,
    };
  }

  // ── Multi-select handlers ──
  function handleTandaClick(index: number, event: MouseEvent) {
    const tanda = editor.tandas[index];
    if (!tanda) return;

    if (selectionMode) {
      // In selection mode, every click toggles selection
      if (event.shiftKey && lastClickedIndex !== null) {
        // Shift+click: select range
        const start = Math.min(lastClickedIndex, index);
        const end = Math.max(lastClickedIndex, index);
        const next = new Set(selectedTandas);
        for (let i = start; i <= end; i++) {
          const t = editor.tandas[i];
          if (t) next.add(t.id);
        }
        selectedTandas = next;
      } else {
        // Regular click in selection mode: toggle this one
        const next = new Set(selectedTandas);
        if (next.has(tanda.id)) {
          next.delete(tanda.id);
        } else {
          next.add(tanda.id);
        }
        selectedTandas = next;
        // Exit selection mode if nothing selected
        if (next.size === 0) {
          selectionMode = false;
        }
      }
      lastClickedIndex = index;
    } else {
      // Not in selection mode: open the panel as before
      openSlotIndex = index;
    }
  }

  function enterSelectionMode() {
    selectionMode = true;
    selectedTandas = new Set();
    lastClickedIndex = null;
  }

  function exitSelectionMode() {
    selectionMode = false;
    selectedTandas = new Set();
    lastClickedIndex = null;
  }

  function selectAll() {
    const next = new Set<string>();
    for (const t of editor.tandas) {
      next.add(t.id);
    }
    selectedTandas = next;
    selectionMode = true;
  }

  function deleteSelected() {
    if (selectedTandas.size === 0) return;
    editor.removeTandas(selectedTandas);
    tandaCount = editor.tandas.length;
    exitSelectionMode();
  }

  function changeGenreSelected(genre: Genre) {
    if (selectedTandas.size === 0) return;
    editor.updateTandas(selectedTandas, { genre });
  }

  let showSaveDialog = $state(false);
  let showImportDialog = $state(false);

  function handleImport(tandas: Tanda[], title: string) {
    // Replace current editor content with imported tandas
    editor.tandas = tandas;
    tandaCount = tandas.length;
    if (title && !editor.title) {
      editor.title = title;
    }
  }

  async function handleSave() {
    // If not logged in, show the friendly dialog instead of saving directly
    if (!authState.user) {
      showSaveDialog = true;
      return;
    }
    await doSave();
  }

  async function doSave() {
    if (!authState.user) return;
    const id = await editor.save(
      authState.user.uid,
      authState.user.displayName ?? 'Anonymous'
    );
    goto(`/set/${id}`);
  }

  async function handleSignInAndSave() {
    try {
      await authState.signInWithGoogle();
    } catch (e) {
      console.error('Sign-in cancelled or failed:', e);
      return;
    }
    if (!authState.user) return;
    showSaveDialog = false;
    await doSave();
  }

  function handleExportPDF() {
    showSaveDialog = false;
    const title = editor.title || 'Untitled Set';
    const tandas = editor.tandas;
    const w = window.open('', '_blank');
    if (!w) return;

    let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 40px; color: #111; max-width: 800px; margin: 0 auto; }
      h1 { font-size: 28px; font-weight: 700; margin-bottom: 4px; }
      .meta { font-size: 12px; color: #737373; margin-bottom: 32px; }
      .tanda { margin-bottom: 28px; page-break-inside: avoid; }
      .tanda-header { display: flex; align-items: baseline; gap: 12px; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid #eee; }
      .tanda-num { font-size: 14px; color: #ccc; font-style: italic; }
      .tanda-name { font-size: 18px; font-weight: 600; }
      .tanda-meta { font-size: 11px; color: #999; text-transform: uppercase; letter-spacing: 0.1em; }
      table { width: 100%; border-collapse: collapse; font-size: 13px; }
      th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: #999; padding: 4px 0; border-bottom: 1px solid #eee; }
      td { padding: 6px 0; border-bottom: 1px solid #f5f5f5; }
      td.num { color: #ccc; width: 30px; }
      td.year { color: #999; text-align: right; font-variant-numeric: tabular-nums; width: 50px; }
      td.singer { color: #737373; font-style: italic; width: 140px; }
      .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #eee; font-size: 10px; color: #ccc; text-align: center; }
      @media print { body { padding: 20px; } }
    </style></head><body>`;
    html += `<h1>${title}</h1>`;
    html += `<p class="meta">${tandas.length} tandas · ${tandas.reduce((s, t) => s + t.songs.length, 0)} songs</p>`;

    for (const tanda of tandas) {
      if (!tanda.orchestra && tanda.songs.length === 0) continue;
      html += `<div class="tanda">`;
      html += `<div class="tanda-header">
        <span class="tanda-num">${String(tanda.num).padStart(2, '0')}</span>
        <span class="tanda-name">${tanda.orchestra || 'Untitled'}</span>
        <span class="tanda-meta">${tanda.genre}</span>
      </div>`;
      html += `<table><thead><tr><th>#</th><th>Title</th><th>Singer</th><th style="text-align:right">Year</th></tr></thead><tbody>`;
      tanda.songs.forEach((song, si) => {
        html += `<tr><td class="num">${si + 1}</td><td>${song.title}</td><td class="singer">${song.singer || ''}</td><td class="year">${song.year || ''}</td></tr>`;
      });
      html += `</tbody></table></div>`;
    }

    html += `<div class="footer">Exported from tandabase · ${new Date().toLocaleDateString()}</div>`;
    html += `</body></html>`;
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 300);
  }
</script>

<svelte:head>
  <title>{editor.setId ? 'Edit Set' : 'Create Set'} - Tandabase</title>
</svelte:head>

{#if loading}
  <div class="flex items-center justify-center min-h-[60vh] pt-28">
    <p class="text-ink-muted text-sm font-light">Loading...</p>
  </div>
{:else}
  <div class="pt-28 md:pt-36 pb-16 bg-surface dark:bg-background text-ink min-h-screen">
    <div class="max-w-[1400px] mx-auto px-6 md:px-16 w-full">

      <!-- Header -->
      <div class="pt-8 pb-12 border-b border-black/10 dark:border-white/10 mb-12">
        <div class="font-mono text-xs text-ink-muted mb-4 uppercase tracking-widest">&gt; Set_Architect</div>
        <h1 class="font-serif text-5xl md:text-6xl font-bold text-ink tracking-tight leading-tight">
          {editor.setId ? 'Edit Set' : 'New Set'}
        </h1>
        <div class="flex flex-col sm:flex-row sm:items-center gap-4 mt-6">
          <p class="text-lg text-ink-muted font-light max-w-xl">
            Build from scratch or import an existing set.
          </p>
          <button
            onclick={() => showImportDialog = true}
            class="sm:ml-auto shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-full border border-black/10 dark:border-white/10 hover:border-black/30 dark:hover:border-white/30 hover:bg-black/5 dark:hover:bg-white/5 transition-all cursor-pointer bg-transparent font-sans text-sm font-medium text-ink-muted hover:text-ink"
          >
            <Upload class="w-4 h-4" />
            Import Set
          </button>
        </div>
      </div>

      <div class="flex flex-col lg:flex-row gap-12 items-start">

        <!-- Left: Global parameters (sticky) -->
        <div class="w-full lg:w-1/3 bg-white dark:bg-card p-8 rounded-2xl border border-black/5 dark:border-white/5 shadow-sm lg:sticky lg:top-32 space-y-8">
          <h3 class="font-medium text-lg text-ink border-b border-black/5 dark:border-white/5 pb-4">Set Details</h3>

          <div>
            <span class="text-xs font-medium text-ink uppercase tracking-widest mb-2 block">Title</span>
            <input
              type="text"
              bind:value={editor.title}
              placeholder="My Practica Set"
              class="w-full bg-surface dark:bg-background border border-black/5 dark:border-white/5 rounded-xl px-4 py-3 text-sm text-ink outline-none focus:border-ink dark:focus:border-white transition-colors font-sans"
            />
          </div>

          <div>
            <span class="text-xs font-medium text-ink uppercase tracking-widest mb-2 block">Description</span>
            <textarea
              bind:value={editor.description}
              placeholder="What's this set about?"
              rows="3"
              class="w-full bg-surface dark:bg-background border border-black/5 dark:border-white/5 rounded-xl px-4 py-3 text-sm text-ink outline-none focus:border-ink dark:focus:border-white transition-colors font-sans resize-none"
            ></textarea>
          </div>

          <div>
            <span class="text-xs font-medium text-ink uppercase tracking-widest mb-2 block">Cover Image</span>
            <input
              type="text"
              bind:value={editor.cover_image}
              placeholder="https://..."
              class="w-full bg-surface dark:bg-background border border-black/5 dark:border-white/5 rounded-xl px-4 py-3 text-sm text-ink outline-none focus:border-ink dark:focus:border-white transition-colors font-sans"
            />
            {#if editor.cover_image}
              <img src={editor.cover_image} alt="Cover" class="mt-3 w-full h-32 object-cover rounded-xl border border-black/5 dark:border-white/5" />
            {/if}
          </div>

          <!-- Visibility toggle -->
          <div>
            <button
              onclick={() => editor.visibility = editor.visibility === 'public' ? 'private' : 'public'}
              class="flex items-center gap-3 w-full p-3 rounded-xl border border-black/5 dark:border-white/5 hover:bg-black/5 dark:hover:bg-white/5 transition-all cursor-pointer bg-transparent font-sans"
            >
              {#if editor.visibility === 'public'}
                <Eye class="w-4 h-4 text-vals" />
                <span class="text-sm font-medium text-ink">Public</span>
                <span class="text-xs text-ink-muted ml-auto">Anyone can find this</span>
              {:else}
                <EyeOff class="w-4 h-4 text-ink-muted" />
                <span class="text-sm font-medium text-ink">Private</span>
                <span class="text-xs text-ink-muted ml-auto">Only you</span>
              {/if}
            </button>
          </div>

          <!-- Save button — prompts sign-in if needed -->
          <button
            onclick={handleSave}
            disabled={editor.saving || !editor.title.trim()}
            class="w-full py-3.5 bg-ink text-surface rounded-xl text-sm font-medium hover:opacity-80 transition-all cursor-pointer border-none font-sans shadow-lg disabled:opacity-30 disabled:cursor-default flex items-center justify-center gap-2"
          >
            <Save class="w-4 h-4" />
            {#if editor.saving}
              Saving...
            {:else if !authState.isLoggedIn}
              Sign in & Save
            {:else if editor.setId}
              Update Set
            {:else}
              Save Set
            {/if}
          </button>

          <div class="text-center">
            <span class="text-xs text-ink-faint">
              {editor.tandaCount} tandas · {editor.songCount} songs
            </span>
          </div>
        </div>

        <!-- Right: Tanda slots grid -->
        <div class="w-full lg:w-2/3">
          <div class="flex justify-between items-end mb-6">
            <h3 class="font-serif text-3xl text-ink">Timeline</h3>
            <div class="flex items-center gap-3">
              {#if !selectionMode}
                <button
                  onclick={enterSelectionMode}
                  class="text-xs font-medium text-ink-muted hover:text-ink bg-surface dark:bg-background px-3 py-1.5 rounded-full border border-black/5 dark:border-white/5 transition-colors cursor-pointer bg-transparent font-sans"
                >
                  <span class="flex items-center gap-1.5">
                    <CheckSquare class="w-3 h-3" />
                    Select
                  </span>
                </button>
              {/if}
              <span class="text-sm font-medium text-ink-muted bg-surface dark:bg-background px-4 py-1.5 rounded-full border border-black/5 dark:border-white/5">
                {tandaCount} Tandas · {editor.songCount} Songs
              </span>
            </div>
          </div>

          <!-- Bulk action toolbar -->
          {#if selectionMode}
            <div class="mb-4 flex items-center gap-3 flex-wrap bg-white dark:bg-card p-3 rounded-xl border border-black/10 dark:border-white/10 shadow-sm">
              <span class="text-sm font-medium text-ink mr-1">
                {selectedCount} selected
              </span>

              <button
                onclick={selectAll}
                class="text-xs px-3 py-1.5 rounded-lg bg-surface dark:bg-background border border-black/5 dark:border-white/5 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer bg-transparent font-sans text-ink-muted hover:text-ink"
              >
                Select All
              </button>

              <div class="w-px h-5 bg-black/10 dark:bg-white/10"></div>

              <!-- Genre change buttons -->
              <span class="text-xs text-ink-muted">Genre:</span>
              <button
                onclick={() => changeGenreSelected('Tango')}
                disabled={selectedCount === 0}
                class="text-[10px] font-bold px-2 py-1 rounded uppercase tracking-widest bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 hover:opacity-80 transition-opacity cursor-pointer border-none font-sans disabled:opacity-30 disabled:cursor-default"
              >
                Tango
              </button>
              <button
                onclick={() => changeGenreSelected('Milonga')}
                disabled={selectedCount === 0}
                class="text-[10px] font-bold px-2 py-1 rounded uppercase tracking-widest bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 hover:opacity-80 transition-opacity cursor-pointer border-none font-sans disabled:opacity-30 disabled:cursor-default"
              >
                Milonga
              </button>
              <button
                onclick={() => changeGenreSelected('Vals')}
                disabled={selectedCount === 0}
                class="text-[10px] font-bold px-2 py-1 rounded uppercase tracking-widest bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 hover:opacity-80 transition-opacity cursor-pointer border-none font-sans disabled:opacity-30 disabled:cursor-default"
              >
                Vals
              </button>

              <div class="w-px h-5 bg-black/10 dark:bg-white/10"></div>

              <!-- Delete -->
              <button
                onclick={deleteSelected}
                disabled={selectedCount === 0}
                class="text-xs px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors cursor-pointer border-none font-sans flex items-center gap-1.5 disabled:opacity-30 disabled:cursor-default"
              >
                <Trash2 class="w-3 h-3" />
                Delete
              </button>

              <div class="ml-auto">
                <button
                  onclick={exitSelectionMode}
                  class="text-xs px-3 py-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer bg-transparent border-none font-sans text-ink-muted hover:text-ink flex items-center gap-1"
                >
                  <X class="w-3 h-3" />
                  Cancel
                </button>
              </div>
            </div>
          {/if}

          <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {#each editor.tandas as tanda, i (tanda.id)}
              {@const summary = getSlotSummary(i)}
              {@const isSelected = selectedTandas.has(tanda.id)}
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <div
                draggable={!selectionMode}
                onclick={(e) => handleTandaClick(i, e)}
                ondragstart={(e) => handleDragStart(i, e)}
                ondragover={(e) => handleDragOver(i, e)}
                ondrop={(e) => handleDrop(i, e)}
                ondragend={handleDragEnd}
                onmouseenter={(e) => summary.filled && handleTandaMouseEnter(i, e)}
                onmouseleave={handleTandaMouseLeave}
                class="group relative rounded-xl p-5 cursor-grab active:cursor-grabbing transition-all border-2 select-none
                  {dragIndex === i ? 'opacity-40 scale-95' : ''}
                  {isSelected
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 dark:border-blue-400 shadow-md ring-2 ring-blue-200 dark:ring-blue-800'
                    : summary.filled
                      ? 'bg-white dark:bg-card border-black/10 dark:border-white/10 hover:border-ink dark:hover:border-white shadow-sm hover:shadow-md'
                      : 'bg-surface dark:bg-background border-dashed border-black/15 dark:border-white/15 hover:bg-white dark:hover:bg-card hover:border-ink/50 dark:hover:border-white/50 hover:shadow-md'}"
              >
                <!-- Drop indicator lines -->
                {#if dragOverIndex === i && dragIndex !== null && dragIndex !== i}
                  {#if dragOverPosition === 'before'}
                    <div class="absolute left-0 top-1 bottom-1 w-[3px] bg-blue-500 rounded-full -translate-x-[calc(50%+8px)] z-10"></div>
                    <div class="absolute left-0 top-0 w-2 h-2 bg-blue-500 rounded-full -translate-x-[calc(50%+8px)] -translate-y-0 z-10"></div>
                    <div class="absolute left-0 bottom-0 w-2 h-2 bg-blue-500 rounded-full -translate-x-[calc(50%+8px)] translate-y-0 z-10"></div>
                  {:else}
                    <div class="absolute right-0 top-1 bottom-1 w-[3px] bg-blue-500 rounded-full translate-x-[calc(50%+8px)] z-10"></div>
                    <div class="absolute right-0 top-0 w-2 h-2 bg-blue-500 rounded-full translate-x-[calc(50%+8px)] -translate-y-0 z-10"></div>
                    <div class="absolute right-0 bottom-0 w-2 h-2 bg-blue-500 rounded-full translate-x-[calc(50%+8px)] translate-y-0 z-10"></div>
                  {/if}
                {/if}

                <!-- Selection checkbox indicator -->
                {#if selectionMode}
                  <div class="absolute top-2 right-2 w-5 h-5 rounded border-2 flex items-center justify-center transition-all
                    {isSelected
                      ? 'bg-blue-500 border-blue-500 dark:bg-blue-400 dark:border-blue-400'
                      : 'border-black/20 dark:border-white/20 bg-transparent group-hover:border-black/40 dark:group-hover:border-white/40'}">
                    {#if isSelected}
                      <svg class="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                    {/if}
                  </div>
                {/if}

                <!-- Drag grip -->
                {#if !selectionMode}
                  <div class="absolute top-2 left-2 opacity-0 group-hover:opacity-40 transition-opacity">
                    <GripVertical class="w-4 h-4 text-ink-muted" />
                  </div>
                {/if}

                <span class="font-mono text-[10px] font-bold text-ink-muted">#{String(i + 1).padStart(2, '0')}</span>

                {#if summary.filled}
                  <h4 class="font-serif text-xl text-ink mt-2 leading-tight truncate" title={summary.orchestra}>{summary.orchestra}</h4>

                  <!-- Singer display -->
                  {#if summary.singerDisplay}
                    <p class="text-[11px] text-ink-muted mt-1 truncate" title={summary.singerDisplay}>
                      {#if summary.isInstrumental}
                        <span class="italic">{summary.singerDisplay}</span>
                      {:else}
                        {summary.singerDisplay}
                      {/if}
                    </p>
                  {/if}

                  <!-- Description -->
                  {#if summary.description}
                    <p class="text-[10px] text-ink-faint mt-1 truncate italic" title={summary.description}>{summary.description}</p>
                  {/if}

                  <div class="flex items-center gap-2 mt-2 flex-wrap">
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-widest
                      {summary.genre === 'Tango' ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400' :
                       summary.genre === 'Milonga' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' :
                       'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'}">
                      {summary.genre}
                    </span>
                    {#if summary.yearRange}
                      <span class="text-[10px] font-mono text-ink-faint">{summary.yearRange}</span>
                    {/if}
                    <span class="text-xs text-ink-muted">{summary.songCount} tracks</span>
                  </div>
                {:else}
                  <h4 class="font-serif text-2xl text-ink-faint mt-2 group-hover:text-ink transition-colors">Empty</h4>
                  <p class="text-xs text-ink-faint mt-1 group-hover:text-ink-muted transition-colors">Click to fill</p>
                {/if}
              </div>
            {/each}

            <!-- Add tanda slot -->
            {#if !selectionMode}
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <div
                onclick={() => adjustCount(1)}
                class="group relative bg-transparent border-2 border-dashed border-black/10 dark:border-white/10 rounded-xl p-5 cursor-pointer hover:border-ink/30 dark:hover:border-white/30 transition-all flex flex-col items-center justify-center min-h-[120px]"
              >
                <Plus class="w-6 h-6 text-ink-faint group-hover:text-ink transition-colors" />
                <span class="text-xs text-ink-faint group-hover:text-ink-muted mt-1 transition-colors">Add Tanda</span>
              </div>
            {/if}
          </div>

          <!-- Drag-to-bin zone (visible while dragging) -->
          {#if dragIndex !== null}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              ondragover={handleBinDragOver}
              ondragleave={handleBinDragLeave}
              ondrop={handleBinDrop}
              class="mt-4 flex items-center justify-center gap-3 p-6 rounded-2xl border-2 border-dashed transition-all duration-200
                {dragOverBin
                  ? 'border-red-400 bg-red-50 dark:bg-red-900/20 scale-[1.02]'
                  : 'border-black/15 dark:border-white/15 bg-surface/50 dark:bg-background/50'}"
            >
              <Trash2 class="w-5 h-5 transition-colors {dragOverBin ? 'text-red-500' : 'text-ink-faint'}" />
              <span class="text-sm font-medium transition-colors {dragOverBin ? 'text-red-500' : 'text-ink-muted'}">
                Drop here to delete
              </span>
            </div>
          {/if}

          {#if selectionMode}
            <p class="text-xs text-ink-muted mt-4">
              Click to select individual tandas. Hold <kbd class="px-1.5 py-0.5 rounded bg-surface dark:bg-background border border-black/10 dark:border-white/10 font-mono text-[10px]">Shift</kbd> and click to select a range.
            </p>
          {/if}
        </div>
      </div>
    </div>
  </div>

  <!-- Song popover on hover -->
  {#if hoveredIndex !== null && popoverPosition && editor.tandas[hoveredIndex]?.songs.length > 0}
    {@const hTanda = editor.tandas[hoveredIndex]}
    {@const hSummary = getSlotSummary(hoveredIndex)}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      class="fixed z-50 pointer-events-none"
      style="left: {popoverPosition.x}px; top: {popoverPosition.y}px; transform: translate(-50%, -100%);"
    >
      <div class="bg-white dark:bg-card border border-black/10 dark:border-white/10 rounded-xl shadow-xl p-3 mb-2 min-w-[240px] max-w-[340px]">
        <div class="flex items-center justify-between mb-1">
          <span class="font-serif text-sm font-medium text-ink">{hTanda.orchestra}</span>
          <span class="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-widest
            {hTanda.genre === 'Tango' ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400' :
             hTanda.genre === 'Milonga' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' :
             'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'}">
            {hTanda.genre}
          </span>
        </div>
        <!-- Subtitle info: singer + year range -->
        <div class="flex items-center gap-2 mb-2 text-[10px] text-ink-muted">
          {#if hSummary.singerDisplay}
            <span class={hSummary.isInstrumental ? 'italic' : ''}>{hSummary.singerDisplay}</span>
          {/if}
          {#if hSummary.singerDisplay && hSummary.yearRange}
            <span>·</span>
          {/if}
          {#if hSummary.yearRange}
            <span class="font-mono">{hSummary.yearRange}</span>
          {/if}
        </div>
        {#if hTanda.description}
          <p class="text-[10px] text-ink-faint italic mb-2 truncate">{hTanda.description}</p>
        {/if}
        <div class="space-y-1">
          {#each hTanda.songs as song, si}
            <div class="flex items-center gap-2 text-xs">
              <span class="font-mono text-[10px] text-ink-faint w-4 shrink-0">{si + 1}.</span>
              <span class="text-ink truncate flex-1">{song.title}</span>
              {#if song.singer}
                <span class="text-ink-muted text-[10px] shrink-0">{song.singer}</span>
              {:else}
                <span class="text-ink-faint text-[10px] shrink-0 italic">Instr.</span>
              {/if}
              {#if song.year}
                <span class="font-mono text-[10px] text-ink-faint shrink-0">{song.year}</span>
              {/if}
              {#if song.video_id}
                <span class="text-green-500 text-[10px] shrink-0" title="Has YouTube video">&#9658;</span>
              {:else}
                <span class="text-ink-faint text-[10px] shrink-0" title="No video yet">&#9644;</span>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    </div>
  {/if}

  <!-- Builder Panel (side panel) -->
  {#if openSlotIndex !== null && !selectionMode}
    <TandaBuilderPanel
      slotIndex={openSlotIndex}
      onclose={() => openSlotIndex = null}
      ondelete={() => {
        const tanda = editor.tandas[openSlotIndex ?? -1];
        if (tanda) {
          editor.removeTanda(tanda.id);
          tandaCount = editor.tandas.length;
        }
        openSlotIndex = null;
      }}
    />
  {/if}

  <!-- Save dialog for anonymous users -->
  {#if showSaveDialog}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
      onclick={() => showSaveDialog = false}
    >
      <div class="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>

      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <div
        class="relative bg-card rounded-2xl shadow-2xl border border-black/10 dark:border-white/10 w-full max-w-md overflow-hidden"
        onclick={(e) => e.stopPropagation()}
      >
        <!-- Header -->
        <div class="px-8 pt-8 pb-2">
          <h2 class="font-serif text-2xl text-ink mb-2">Almost there!</h2>
          <p class="text-sm text-ink-muted font-light leading-relaxed">
            To keep your set saved to your account, you'll need to sign in first. It only takes a second — your work stays exactly as you left it.
          </p>
        </div>

        <!-- Options -->
        <div class="px-8 py-6 space-y-3">
          <button
            onclick={handleSignInAndSave}
            class="w-full flex items-center gap-4 p-4 rounded-xl bg-ink text-surface font-medium text-sm cursor-pointer border-none font-sans shadow-lg hover:opacity-90 transition-all active:scale-[0.98]"
          >
            <LogIn class="w-5 h-5 shrink-0" />
            <div class="text-left">
              <div>Sign in with Google</div>
              <div class="text-xs font-light opacity-70 mt-0.5">Your set gets saved to your account</div>
            </div>
          </button>

          <button
            onclick={handleExportPDF}
            class="w-full flex items-center gap-4 p-4 rounded-xl border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 text-ink text-sm cursor-pointer bg-transparent font-sans transition-all active:scale-[0.98]"
          >
            <FileDown class="w-5 h-5 shrink-0 text-ink-muted" />
            <div class="text-left">
              <div class="font-medium">Export as PDF instead</div>
              <div class="text-xs text-ink-muted font-light mt-0.5">Download a copy you can keep</div>
            </div>
          </button>

          <button
            onclick={() => showSaveDialog = false}
            class="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-ink-muted text-sm cursor-pointer bg-transparent border-none font-sans transition-all"
          >
            <ArrowLeft class="w-5 h-5 shrink-0" />
            <div class="text-left">
              <div class="font-medium">Go back and keep editing</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  {/if}

  <ImportDialog
    open={showImportDialog}
    onclose={() => showImportDialog = false}
    onimport={handleImport}
  />
{/if}
