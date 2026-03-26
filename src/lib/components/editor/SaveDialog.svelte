<script lang="ts">
  import { editor } from '$lib/stores/editor.svelte';
  import { authState } from '$lib/stores/auth.svelte';
  import { goto } from '$app/navigation';
  import { X, Eye, EyeOff, LogIn, FileDown, ArrowLeft, Save, Image, Globe, Lock } from 'lucide-svelte';

  let {
    open = false,
    onclose,
  }: {
    open: boolean;
    onclose: () => void;
  } = $props();

  // Which step: 'details' or 'auth'
  let step = $state<'details' | 'auth'>('details');

  // Preset cover images
  const COVER_PRESETS = [
    '/album-covers/di-sarli.jpg',
    '/album-covers/pugliese.jpg',
    '/album-covers/troilo.jpg',
    '/album-covers/darienzo.jpg',

  ];

  let coverTab = $state<'url' | 'preset'>('preset');

  async function handleSave() {
    if (!authState.user) {
      step = 'auth';
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
    onclose();
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
    await doSave();
  }

  function handleExportPDF() {
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
    onclose();
  }

  function handleClose() {
    step = 'details';
    onclose();
  }

  // Reset step when dialog opens
  $effect(() => {
    if (open) step = 'details';
  });
</script>

{#if open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4"
    onclick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
  >
    <div class="absolute inset-0 bg-black/50 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]"></div>

    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      class="relative bg-white dark:bg-card rounded-2xl shadow-2xl border border-black/10 dark:border-white/10 w-full max-w-lg overflow-hidden animate-[fadeIn_0.25s_ease-out]"
      onclick={(e) => e.stopPropagation()}
    >
      {#if step === 'details'}
        <!-- Header -->
        <div class="flex items-center justify-between px-8 pt-8 pb-2">
          <div>
            <h2 class="font-serif text-2xl text-ink">Publish your set</h2>
            <p class="text-sm text-ink-muted font-light mt-1">
              {editor.tandaCount} tandas · {editor.songCount} songs
            </p>
          </div>
          <button
            onclick={handleClose}
            class="w-9 h-9 rounded-full hover:bg-black/5 dark:hover:bg-white/5 flex items-center justify-center transition-colors cursor-pointer bg-transparent border-none"
          >
            <X class="w-5 h-5 text-ink-muted" />
          </button>
        </div>

        <!-- Form -->
        <div class="px-8 py-6 space-y-5">
          <!-- Title -->
          <div>
            <label for="save-title" class="text-xs font-medium text-ink uppercase tracking-widest mb-2 block">Title</label>
            <input
              id="save-title"
              type="text"
              bind:value={editor.title}
              placeholder="My Practica Set"
              class="w-full bg-surface dark:bg-background border border-black/5 dark:border-white/5 rounded-xl px-4 py-3 text-sm text-ink outline-none focus:border-ink dark:focus:border-white transition-colors font-sans"
            />
          </div>

          <!-- Description -->
          <div>
            <label for="save-desc" class="text-xs font-medium text-ink uppercase tracking-widest mb-2 block">Description</label>
            <textarea
              id="save-desc"
              bind:value={editor.description}
              placeholder="What makes this set special? Who is it for?"
              rows="2"
              class="w-full bg-surface dark:bg-background border border-black/5 dark:border-white/5 rounded-xl px-4 py-3 text-sm text-ink outline-none focus:border-ink dark:focus:border-white transition-colors font-sans resize-none"
            ></textarea>
          </div>

          <!-- Cover Image -->
          <div>
            <span class="text-xs font-medium text-ink uppercase tracking-widest mb-2 block">Cover Image</span>
            <div class="flex gap-2 mb-3">
              <button
                onclick={() => coverTab = 'preset'}
                class="text-xs px-3 py-1.5 rounded-lg transition-colors cursor-pointer font-sans border
                  {coverTab === 'preset'
                    ? 'bg-ink text-surface border-ink'
                    : 'bg-transparent text-ink-muted border-black/10 dark:border-white/10 hover:border-black/30 dark:hover:border-white/30'}"
              >
                <span class="flex items-center gap-1.5"><Image class="w-3 h-3" /> Presets</span>
              </button>
              <button
                onclick={() => coverTab = 'url'}
                class="text-xs px-3 py-1.5 rounded-lg transition-colors cursor-pointer font-sans border
                  {coverTab === 'url'
                    ? 'bg-ink text-surface border-ink'
                    : 'bg-transparent text-ink-muted border-black/10 dark:border-white/10 hover:border-black/30 dark:hover:border-white/30'}"
              >
                <span class="flex items-center gap-1.5"><Globe class="w-3 h-3" /> URL</span>
              </button>
            </div>

            {#if coverTab === 'preset'}
              <div class="grid grid-cols-3 gap-2">
                {#each COVER_PRESETS as preset}
                  <!-- svelte-ignore a11y_no_static_element_interactions -->
                  <!-- svelte-ignore a11y_click_events_have_key_events -->
                  <div
                    onclick={() => editor.cover_image = preset}
                    class="relative h-20 rounded-xl overflow-hidden cursor-pointer border-2 transition-all hover:scale-[1.02]
                      {editor.cover_image === preset
                        ? 'border-ink dark:border-white ring-2 ring-ink/20 dark:ring-white/20'
                        : 'border-transparent hover:border-black/20 dark:hover:border-white/20'}"
                  >
                    <img src={preset} alt="" class="w-full h-full object-cover" />
                  </div>
                {/each}
                <!-- No cover option -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <div
                  onclick={() => editor.cover_image = ''}
                  class="relative h-20 rounded-xl overflow-hidden cursor-pointer border-2 transition-all hover:scale-[1.02] flex items-center justify-center bg-surface dark:bg-background
                    {!editor.cover_image
                      ? 'border-ink dark:border-white ring-2 ring-ink/20 dark:ring-white/20'
                      : 'border-transparent hover:border-black/20 dark:hover:border-white/20'}"
                >
                  <span class="text-[10px] text-ink-faint uppercase tracking-widest">None</span>
                </div>
              </div>
            {:else}
              <input
                type="text"
                bind:value={editor.cover_image}
                placeholder="https://..."
                class="w-full bg-surface dark:bg-background border border-black/5 dark:border-white/5 rounded-xl px-4 py-3 text-sm text-ink outline-none focus:border-ink dark:focus:border-white transition-colors font-sans"
              />
              {#if editor.cover_image && !COVER_PRESETS.includes(editor.cover_image)}
                <img src={editor.cover_image} alt="Cover" class="mt-2 w-full h-20 object-cover rounded-xl border border-black/5 dark:border-white/5" />
              {/if}
            {/if}
          </div>

          <!-- Visibility -->
          <button
            onclick={() => editor.visibility = editor.visibility === 'public' ? 'private' : 'public'}
            class="flex items-center gap-3 w-full p-3 rounded-xl border border-black/5 dark:border-white/5 hover:bg-black/5 dark:hover:bg-white/5 transition-all cursor-pointer bg-transparent font-sans"
          >
            {#if editor.visibility === 'public'}
              <Eye class="w-4 h-4 text-vals" />
              <span class="text-sm font-medium text-ink">Public</span>
              <span class="text-xs text-ink-muted ml-auto">Visible in community sets</span>
            {:else}
              <EyeOff class="w-4 h-4 text-ink-muted" />
              <span class="text-sm font-medium text-ink">Private</span>
              <span class="text-xs text-ink-muted ml-auto">Only shareable via link</span>
            {/if}
          </button>
        </div>

        <!-- Footer -->
        <div class="px-8 pb-8 pt-2">
          <button
            onclick={handleSave}
            disabled={editor.saving || !editor.title.trim()}
            class="w-full py-3.5 bg-ink text-surface rounded-xl text-sm font-medium hover:opacity-80 transition-all cursor-pointer border-none font-sans shadow-lg disabled:opacity-30 disabled:cursor-default flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            <Save class="w-4 h-4" />
            {#if editor.saving}
              Saving...
            {:else if !authState.isLoggedIn}
              Continue
            {:else if editor.setId}
              Update Set
            {:else}
              Publish Set
            {/if}
          </button>
        </div>

      {:else if step === 'auth'}
        <!-- Auth step -->
        <div class="px-8 pt-8 pb-2">
          <h2 class="font-serif text-2xl text-ink mb-2">Almost there!</h2>
          <p class="text-sm text-ink-muted font-light leading-relaxed">
            Sign in to save <strong class="text-ink">"{editor.title || 'your set'}"</strong> to your account. Your work stays exactly as you left it.
          </p>
        </div>

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
              <div class="text-xs text-ink-muted font-light mt-0.5">Download a printable copy</div>
            </div>
          </button>

          <button
            onclick={() => step = 'details'}
            class="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-ink-muted text-sm cursor-pointer bg-transparent border-none font-sans transition-all"
          >
            <ArrowLeft class="w-5 h-5 shrink-0" />
            <div class="text-left">
              <div class="font-medium">Go back</div>
            </div>
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}
