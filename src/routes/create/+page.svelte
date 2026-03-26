<script lang="ts">
  import { authState } from '$lib/stores/auth.svelte';
  import { editor } from '$lib/stores/editor.svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { getSet } from '$lib/firebase/db';
  import TandaBuilderPanel from '$lib/components/editor/TandaBuilderPanel.svelte';
  import ImportDialog from '$lib/components/editor/ImportDialog.svelte';
  import SaveDialog from '$lib/components/editor/SaveDialog.svelte';
  import { Plus, Save, Trash2, X, CheckSquare, GripVertical, Upload, Disc3 } from 'lucide-svelte';
  import type { Tanda } from '$lib/types';
  import type { Genre } from '$lib/types';
  import { untrack } from 'svelte';

  let loading = $state(false);
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

  // ── Tanda editor panel ──
  let editingSlotIndex = $state<number | null>(null);

  // ── Dialogs ──
  let showSaveDialog = $state(false);
  let showImportDialog = $state(false);

  function handleDragStart(index: number, event: DragEvent) {
    if (selectionMode) { event.preventDefault(); return; }
    dragIndex = index;
    dragOverIndex = null;
    dragOverBin = false;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(index));
    }
    handleTandaMouseLeave();
  }

  function handleDragOver(index: number, event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    dragOverBin = false;
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    dragOverPosition = event.clientX < midX ? 'before' : 'after';
    dragOverIndex = index;
  }



  function handleDrop(index: number, event: DragEvent) {
    event.preventDefault();
    if (dragIndex !== null && dragIndex !== index) {
      let targetIndex = dragOverPosition === 'after' ? index + 1 : index;
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
  }

  function handleTandaMouseEnter(index: number, event: MouseEvent) {
    if (editingSlotIndex === index) return;
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

    const singers = [...new Set(tanda.songs.map(s => s.singer).filter((s): s is string => !!s && s !== 'Instrumental' && s !== '-'))];
    const instrumentalCount = tanda.songs.filter(s => !s.singer || s.singer === 'Instrumental' || s.singer === '-').length;
    const hasInstrumentals = instrumentalCount > 0;
    const isInstrumental = singers.length === 0 && tanda.songs.length > 0;
    let singerDisplay = '';
    if (isInstrumental) {
      singerDisplay = 'Instrumental';
    } else if (hasInstrumentals && singers.length > 0) {
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
      filled: tanda.songs.length > 0 || !!tanda.orchestra,
      description: tanda.description || '',
      singerDisplay,
      yearRange,
      isInstrumental,
    };
  }

  // ── Click handler: select or open editor ──
  function handleTandaClick(index: number, event: MouseEvent) {
    const tanda = editor.tandas[index];
    if (!tanda) return;

    if (selectionMode) {
      if (event.shiftKey && lastClickedIndex !== null) {
        const start = Math.min(lastClickedIndex, index);
        const end = Math.max(lastClickedIndex, index);
        const next = new Set(selectedTandas);
        for (let i = start; i <= end; i++) {
          const t = editor.tandas[i];
          if (t) next.add(t.id);
        }
        selectedTandas = next;
      } else {
        const next = new Set(selectedTandas);
        if (next.has(tanda.id)) {
          next.delete(tanda.id);
        } else {
          next.add(tanda.id);
        }
        selectedTandas = next;
        if (next.size === 0) {
          selectionMode = false;
        }
      }
      lastClickedIndex = index;
    } else {
      editingSlotIndex = index;
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

  function handleImport(tandas: Tanda[], title: string) {
    editor.tandas = tandas;
    tandaCount = tandas.length;
    if (title && !editor.title) {
      editor.title = title;
    }
  }

  // ── Keyboard shortcut: Escape closes editor or exits selection ──
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      if (editingSlotIndex !== null) {
        editingSlotIndex = null;
        event.preventDefault();
      } else if (selectionMode) {
        exitSelectionMode();
        event.preventDefault();
      }
    }
  }
</script>

<svelte:head>
  <title>{editor.setId ? 'Edit Set' : 'Create Set'} - Tandabase</title>
</svelte:head>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<svelte:window onkeydown={handleKeydown} />

{#if loading}
  <div class="flex items-center justify-center min-h-[60vh] pt-28">
    <p class="text-ink-muted text-sm font-light">Loading...</p>
  </div>
{:else}
  <div class="pt-20 md:pt-24 bg-surface dark:bg-background text-ink min-h-screen flex flex-col">

    <!-- ═══ Compact header bar ═══ -->
    <div class="shrink-0 px-6 md:px-10 py-4 border-b border-black/5 dark:border-white/5 flex items-center gap-4 flex-wrap">
      <div class="flex items-center gap-3 min-w-0">
        <Disc3 class="w-5 h-5 text-tango shrink-0 animate-[spin_8s_linear_infinite]" />
        <h1 class="font-serif text-2xl md:text-3xl font-bold text-ink truncate">
          {editor.setId ? 'Edit Set' : 'Set Architect'}
        </h1>
      </div>

      <div class="flex items-center gap-2 ml-auto">
        <span class="text-xs text-ink-faint font-mono hidden sm:inline">
          {editor.tandaCount} tandas · {editor.songCount} songs
        </span>

        <button
          onclick={() => showImportDialog = true}
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-black/10 dark:border-white/10 hover:border-black/30 dark:hover:border-white/30 hover:bg-black/5 dark:hover:bg-white/5 transition-all cursor-pointer bg-transparent font-sans text-xs font-medium text-ink-muted hover:text-ink"
        >
          <Upload class="w-3.5 h-3.5" />
          <span class="hidden sm:inline">Import</span>
        </button>

        <button
          onclick={() => showSaveDialog = true}
          class="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-ink text-surface text-xs font-medium hover:opacity-80 transition-all cursor-pointer border-none font-sans shadow-sm"
        >
          <Save class="w-3.5 h-3.5" />
          {editor.setId ? 'Update' : 'Save'}
        </button>
      </div>
    </div>

    <!-- ═══ Main content ═══ -->
    <div class="flex-1 flex flex-col min-h-0 overflow-hidden">
        <!-- Timeline header -->
        <div class="shrink-0 px-6 md:px-8 py-3 flex justify-between items-center border-b border-black/5 dark:border-white/5 bg-surface/50 dark:bg-background/50">
          <div class="flex items-center gap-3">
            <h3 class="font-serif text-xl text-ink">Timeline</h3>
          </div>
          <div class="flex items-center gap-2">
            {#if !selectionMode}
              <button
                onclick={enterSelectionMode}
                class="text-xs font-medium text-ink-muted hover:text-ink px-2.5 py-1 rounded-md border border-black/5 dark:border-white/5 transition-colors cursor-pointer bg-transparent font-sans"
              >
                <span class="flex items-center gap-1.5">
                  <CheckSquare class="w-3 h-3" />
                  Select
                </span>
              </button>
            {/if}
          </div>
        </div>

        <!-- Bulk action toolbar -->
        {#if selectionMode}
          <div class="shrink-0 px-6 md:px-8 py-2 flex items-center gap-3 flex-wrap bg-white dark:bg-card border-b border-black/10 dark:border-white/10">
            <span class="text-sm font-medium text-ink mr-1">
              {selectedCount} selected
            </span>

            <button
              onclick={selectAll}
              class="text-xs px-2.5 py-1 rounded-md bg-surface dark:bg-background border border-black/5 dark:border-white/5 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer font-sans text-ink-muted hover:text-ink"
            >
              Select All
            </button>

            <div class="w-px h-4 bg-black/10 dark:bg-white/10"></div>

            <span class="text-xs text-ink-muted">Genre:</span>
            <button
              onclick={() => changeGenreSelected('Tango')}
              disabled={selectedCount === 0}
              class="text-[10px] font-bold px-2 py-1 rounded uppercase tracking-widest bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 hover:opacity-80 transition-opacity cursor-pointer border-none font-sans disabled:opacity-30 disabled:cursor-default"
            >
              T
            </button>
            <button
              onclick={() => changeGenreSelected('Milonga')}
              disabled={selectedCount === 0}
              class="text-[10px] font-bold px-2 py-1 rounded uppercase tracking-widest bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 hover:opacity-80 transition-opacity cursor-pointer border-none font-sans disabled:opacity-30 disabled:cursor-default"
            >
              M
            </button>
            <button
              onclick={() => changeGenreSelected('Vals')}
              disabled={selectedCount === 0}
              class="text-[10px] font-bold px-2 py-1 rounded uppercase tracking-widest bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 hover:opacity-80 transition-opacity cursor-pointer border-none font-sans disabled:opacity-30 disabled:cursor-default"
            >
              V
            </button>

            <div class="w-px h-4 bg-black/10 dark:bg-white/10"></div>

            <button
              onclick={deleteSelected}
              disabled={selectedCount === 0}
              class="text-xs px-2.5 py-1 rounded-md bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors cursor-pointer border-none font-sans flex items-center gap-1 disabled:opacity-30 disabled:cursor-default"
            >
              <Trash2 class="w-3 h-3" />
              Delete
            </button>

            <button
              onclick={exitSelectionMode}
              class="ml-auto text-xs px-2.5 py-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer bg-transparent border-none font-sans text-ink-muted hover:text-ink flex items-center gap-1"
            >
              <X class="w-3 h-3" />
              Cancel
            </button>
          </div>
        {/if}

        <!-- ═══ Tanda grid ═══ -->
        <div class="flex-1 overflow-y-auto px-6 md:px-8 py-6">
          <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
                class="group relative rounded-xl p-4 transition-all duration-200 border-2 select-none
                  {dragIndex === i ? 'opacity-40 scale-95' : ''}
                  {isSelected
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 dark:border-blue-400 shadow-md ring-2 ring-blue-200 dark:ring-blue-800 cursor-pointer'
                    : summary.filled
                      ? 'bg-white dark:bg-card border-black/10 dark:border-white/10 hover:border-ink dark:hover:border-white shadow-sm hover:shadow-md cursor-pointer'
                      : 'bg-surface dark:bg-background border-dashed border-black/15 dark:border-white/15 hover:bg-white dark:hover:bg-card hover:border-ink/50 dark:hover:border-white/50 hover:shadow-md cursor-pointer'}"
              >
                <!-- Genre accent bar -->
                <div class="absolute left-0 top-3 bottom-3 w-[3px] rounded-full transition-all duration-200
                  {summary.filled
                    ? (summary.genre === 'Tango' ? 'bg-tango' :
                       summary.genre === 'Milonga' ? 'bg-milonga' :
                       summary.genre === 'Vals' ? 'bg-vals' : 'bg-transparent')
                    : 'bg-transparent'}">
                </div>

                <!-- Drop indicator lines -->
                {#if dragOverIndex === i && dragIndex !== null && dragIndex !== i}
                  {#if dragOverPosition === 'before'}
                    <div class="absolute left-0 top-1 bottom-1 w-[3px] bg-blue-500 rounded-full -translate-x-[calc(50%+8px)] z-10"></div>
                    <div class="absolute left-0 top-0 w-2 h-2 bg-blue-500 rounded-full -translate-x-[calc(50%+8px)] z-10"></div>
                    <div class="absolute left-0 bottom-0 w-2 h-2 bg-blue-500 rounded-full -translate-x-[calc(50%+8px)] z-10"></div>
                  {:else}
                    <div class="absolute right-0 top-1 bottom-1 w-[3px] bg-blue-500 rounded-full translate-x-[calc(50%+8px)] z-10"></div>
                    <div class="absolute right-0 top-0 w-2 h-2 bg-blue-500 rounded-full translate-x-[calc(50%+8px)] z-10"></div>
                    <div class="absolute right-0 bottom-0 w-2 h-2 bg-blue-500 rounded-full translate-x-[calc(50%+8px)] z-10"></div>
                  {/if}
                {/if}

                <!-- Selection checkbox -->
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

                <span class="font-mono text-[10px] font-bold text-ink-muted pl-2">#{String(i + 1).padStart(2, '0')}</span>

                {#if summary.filled}
                  <h4 class="font-serif text-lg text-ink mt-1.5 leading-tight truncate pl-2" title={summary.orchestra}>{summary.orchestra}</h4>

                  {#if summary.singerDisplay}
                    <p class="text-[11px] text-ink-muted mt-0.5 truncate pl-2" title={summary.singerDisplay}>
                      {#if summary.isInstrumental}
                        <span class="italic">{summary.singerDisplay}</span>
                      {:else}
                        {summary.singerDisplay}
                      {/if}
                    </p>
                  {/if}

                  {#if summary.description}
                    <p class="text-[10px] text-ink-faint mt-0.5 truncate italic pl-2" title={summary.description}>{summary.description}</p>
                  {/if}

                  <div class="flex items-center gap-2 mt-2 flex-wrap pl-2">
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-widest
                      {summary.genre === 'Tango' ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400' :
                       summary.genre === 'Milonga' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' :
                       'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'}">
                      {summary.genre}
                    </span>
                    {#if summary.yearRange}
                      <span class="text-[10px] font-mono text-ink-faint">{summary.yearRange}</span>
                    {/if}
                    <span class="text-[10px] text-ink-muted">{summary.songCount} tracks</span>
                  </div>
                {:else}
                  <div class="pl-2">
                    <h4 class="font-serif text-xl text-ink-faint mt-1.5 group-hover:text-ink transition-colors">Empty</h4>
                    <p class="text-xs text-ink-faint mt-0.5 group-hover:text-ink-muted transition-colors">Click to fill</p>
                  </div>
                {/if}
              </div>
            {/each}

            <!-- Add tanda slot -->
            {#if !selectionMode}
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <div
                onclick={() => adjustCount(1)}
                class="group relative bg-transparent border-2 border-dashed border-black/10 dark:border-white/10 rounded-xl p-4 cursor-pointer hover:border-ink/30 dark:hover:border-white/30 transition-all flex flex-col items-center justify-center min-h-[100px]"
              >
                <Plus class="w-5 h-5 text-ink-faint group-hover:text-ink transition-colors" />
                <span class="text-[10px] text-ink-faint group-hover:text-ink-muted mt-1 transition-colors">Add Tanda</span>
              </div>
            {/if}
          </div>

          <!-- Drag-to-bin zone -->
          {#if dragIndex !== null}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              ondragover={handleBinDragOver}
              ondragleave={handleBinDragLeave}
              ondrop={handleBinDrop}
              class="mt-4 flex items-center justify-center gap-3 p-5 rounded-xl border-2 border-dashed transition-all duration-200
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
              Click to select. Hold <kbd class="px-1.5 py-0.5 rounded bg-surface dark:bg-background border border-black/10 dark:border-white/10 font-mono text-[10px]">Shift</kbd> for range.
            </p>
          {/if}
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
      <div class="bg-white dark:bg-card border border-black/10 dark:border-white/10 rounded-xl shadow-xl p-3 mb-2 min-w-[220px] max-w-[320px]">
        <div class="flex items-center justify-between mb-1">
          <span class="font-serif text-sm font-medium text-ink">{hTanda.orchestra}</span>
          <span class="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-widest
            {hTanda.genre === 'Tango' ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400' :
             hTanda.genre === 'Milonga' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' :
             'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'}">
            {hTanda.genre}
          </span>
        </div>
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

  <!-- Tanda editor panel -->
  {#if editingSlotIndex !== null && !selectionMode}
    <TandaBuilderPanel
      slotIndex={editingSlotIndex}
      onclose={() => editingSlotIndex = null}
      ondelete={() => {
        const tanda = editor.tandas[editingSlotIndex ?? -1];
        if (tanda) {
          editor.removeTanda(tanda.id);
          tandaCount = editor.tandas.length;
        }
        editingSlotIndex = null;
      }}
    />
  {/if}

  <!-- Save / Publish dialog -->
  <SaveDialog
    open={showSaveDialog}
    onclose={() => showSaveDialog = false}
  />

  <ImportDialog
    open={showImportDialog}
    onclose={() => showImportDialog = false}
    onimport={handleImport}
  />
{/if}
