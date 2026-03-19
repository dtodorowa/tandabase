<script lang="ts">
  import { page } from '$app/state';
  import { getSet, getCommentsForSet, createComment, deleteComment } from '$lib/firebase/db';
  import { playerModal } from '$lib/stores/playerModal.svelte';
  import { authState } from '$lib/stores/auth.svelte';
  import type { PracticaSet, Comment, Tanda } from '$lib/types';
  import { FileDown, MessageCircle, Send, Trash2, ChevronDown, Pencil } from 'lucide-svelte';

  import seedData from '$lib/data/seed.json';

  let practicaSet = $state<PracticaSet | null>(null);
  let loading = $state(true);
  let error = $state('');
  let comments = $state<Comment[]>([]);

  // Comment input state
  let newSetComment = $state('');
  let sendingSetComment = $state(false);
  let tandaCommentTexts = $state<Record<number, string>>({});
  let sendingTandaComment = $state<Record<number, boolean>>({});
  let expandedTandaComments = $state<Record<number, boolean>>({});
  let showSetComments = $state(true);

  const setId = $derived(page.params.id ?? '');

  // Set-level comments (tandaIndex === -1)
  const setLevelComments = $derived(
    comments.filter(c => c.tandaIndex === -1)
  );

  $effect(() => {
    if (setId) loadSet(setId);
  });

  async function loadSet(id: string) {
    loading = true;
    error = '';
    try {
      if (id === 'demo') {
        practicaSet = {
          id: 'demo',
          title: seedData.meta.title,
          description: seedData.meta.description,
          authorId: 'demo',
          authorName: 'Demo',
          visibility: 'public',
          genre_summary: [...new Set(seedData.tandas.map(t => t.genre))] as PracticaSet['genre_summary'],
          tanda_count: seedData.tandas.length,
          song_count: seedData.tandas.reduce((sum, t) => sum + t.songs.length, 0),
          created_at: new Date(seedData.meta.created_at),
          updated_at: new Date(seedData.meta.updated_at),
          tandas: seedData.tandas.map(t => ({
            ...t,
            genre: t.genre as import('$lib/types').Genre,
            songs: t.songs.map(s => ({
              ...s,
              video_title: s.title,
              thumbnail: `https://img.youtube.com/vi/${s.video_id}/mqdefault.jpg`,
            })),
          })),
        };
      } else {
        const set = await getSet(id);
        if (!set) {
          error = 'Set not found';
          return;
        }
        practicaSet = set;
        loadComments(id);
      }
    } catch (e) {
      error = 'Failed to load set';
      console.error(e);
    } finally {
      loading = false;
    }
  }

  function getYearRange(tanda: Tanda): string {
    const years = tanda.songs.map(s => s.year).filter((y): y is number => y !== null).sort();
    if (!years.length) return '';
    return years[0] === years[years.length - 1] ? String(years[0]) : `${years[0]}\u2013${years[years.length - 1]}`;
  }

  function getSingers(tanda: Tanda): string {
    const singers = [...new Set(tanda.songs.map(s => s.singer).filter(Boolean))];
    return singers.join(', ');
  }

  async function loadComments(id: string) {
    try {
      comments = await getCommentsForSet(id);
    } catch (e) {
      console.error('Failed to load comments:', e);
    }
  }

  function openPlayer(tandaIndex: number) {
    if (!practicaSet) return;
    playerModal.openModal(practicaSet, tandaIndex);
  }

  function formatDate(d: any): string {
    if (!d) return '';
    const date = d.toDate ? d.toDate() : (d instanceof Date ? d : new Date(d));
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  // ── Comment actions ──
  async function postSetComment() {
    if (!newSetComment.trim() || !authState.user || !practicaSet?.id) return;
    sendingSetComment = true;
    try {
      await createComment({
        setId: practicaSet.id,
        tandaIndex: -1,
        authorId: authState.user.uid,
        authorName: authState.user.displayName || 'Anonymous',
        authorPhoto: authState.user.photoURL || null,
        text: newSetComment.trim(),
      });
      newSetComment = '';
      loadComments(practicaSet.id);
    } catch (e) {
      console.error('Failed to post comment:', e);
    } finally {
      sendingSetComment = false;
    }
  }

  async function postTandaComment(tandaIndex: number) {
    const text = tandaCommentTexts[tandaIndex]?.trim();
    if (!text || !authState.user || !practicaSet?.id) return;
    sendingTandaComment = { ...sendingTandaComment, [tandaIndex]: true };
    try {
      await createComment({
        setId: practicaSet.id,
        tandaIndex,
        authorId: authState.user.uid,
        authorName: authState.user.displayName || 'Anonymous',
        authorPhoto: authState.user.photoURL || null,
        text,
      });
      tandaCommentTexts = { ...tandaCommentTexts, [tandaIndex]: '' };
      loadComments(practicaSet.id);
    } catch (e) {
      console.error('Failed to post comment:', e);
    } finally {
      sendingTandaComment = { ...sendingTandaComment, [tandaIndex]: false };
    }
  }

  async function handleDeleteComment(commentId: string) {
    if (!practicaSet?.id) return;
    try {
      await deleteComment(commentId);
      loadComments(practicaSet.id);
    } catch (e) {
      console.error('Failed to delete comment:', e);
    }
  }

  // ── PDF Export ──
  function exportPDF() {
    if (!practicaSet) return;
    const w = window.open('', '_blank');
    if (!w) return;

    let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${practicaSet.title}</title>
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

    html += `<h1>${practicaSet.title}</h1>`;
    html += `<p class="meta">By ${practicaSet.authorName} · ${practicaSet.tanda_count} tandas · ${practicaSet.song_count} songs</p>`;

    for (const tanda of practicaSet.tandas) {
      const yr = getYearRange(tanda);
      const singers = getSingers(tanda);
      html += `<div class="tanda">`;
      html += `<div class="tanda-header">
        <span class="tanda-num">${String(tanda.num).padStart(2, '0')}</span>
        <span class="tanda-name">${tanda.orchestra}</span>
        <span class="tanda-meta">${tanda.genre}${singers ? ' · ' + singers : ''}${yr ? ' · ' + yr : ''}</span>
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
  <title>{practicaSet?.title ?? 'Tandabase'}</title>
</svelte:head>

<div class="pt-28 md:pt-36 pb-16 bg-surface dark:bg-background text-ink min-h-screen">
  {#if loading}
    <div class="flex items-center justify-center min-h-[60vh]">
      <p class="text-ink-muted text-sm font-light">Loading set...</p>
    </div>
  {:else if error}
    <div class="flex items-center justify-center min-h-[60vh]">
      <p class="text-tango text-sm font-light">{error}</p>
    </div>
  {:else if practicaSet}
    <div class="max-w-4xl mx-auto px-6 w-full">

      <!-- Set header -->
      <div class="pt-12 pb-16 border-b border-black/10 dark:border-white/10 mb-12">
        <div class="flex items-center justify-between mb-8">
          <a href="/browse" class="text-ink-muted hover:text-ink text-xs uppercase tracking-[0.15em] font-medium flex items-center gap-2 transition-colors no-underline">
            ← Back to Archive
          </a>
          <div class="flex items-center gap-2">
            {#if authState.isLoggedIn && authState.user?.uid === practicaSet.authorId}
              <a
                href="/create?edit={practicaSet.id}"
                class="flex items-center justify-center w-10 h-10 rounded-full border border-black/10 dark:border-white/10 hover:border-black/30 dark:hover:border-white/30 hover:bg-black/5 dark:hover:bg-white/5 transition-all text-ink-muted hover:text-ink no-underline"
                title="Edit set"
              >
                <Pencil class="w-4 h-4" />
              </a>
            {/if}
            <button
              onclick={exportPDF}
              class="flex items-center gap-2 px-5 py-2.5 rounded-full border border-black/10 dark:border-white/10 hover:border-black/30 dark:hover:border-white/30 hover:bg-black/5 dark:hover:bg-white/5 transition-all cursor-pointer bg-transparent font-sans text-sm font-medium text-ink-muted hover:text-ink"
            >
              <FileDown class="w-4 h-4" />
              Export PDF
            </button>
          </div>
        </div>

        <h1 class="font-serif text-5xl md:text-6xl font-bold text-ink mb-6 tracking-tight leading-tight">
          {practicaSet.title}
        </h1>

        <div class="flex flex-col md:flex-row md:items-center gap-6 justify-between">
          {#if practicaSet.description}
            <p class="text-lg text-ink-muted font-light max-w-xl leading-relaxed">
              {practicaSet.description}
            </p>
          {:else}
            <p class="text-lg text-ink-muted font-light max-w-xl leading-relaxed">
              A set by {practicaSet.authorName}.
            </p>
          {/if}

          <div class="flex flex-col items-start md:items-end gap-2 shrink-0">
            <span class="text-xs uppercase tracking-widest text-ink-faint font-medium">Structure</span>
            <span class="text-ink font-medium tracking-wide">{practicaSet.tanda_count} Tandas &bull; {practicaSet.song_count} Songs</span>
          </div>
        </div>
      </div>

      <!-- Tanda list -->
      <div class="space-y-16">
        {#each practicaSet.tandas as tanda, i (tanda.id)}
          {@const yr = getYearRange(tanda)}
          {@const singers = getSingers(tanda)}
          {@const tandaComments = comments.filter(c => c.tandaIndex === i)}
          {@const isExpanded = expandedTandaComments[i] ?? false}

          <div>
            <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-6">
              <div class="flex items-baseline gap-6">
                <span class="font-serif text-4xl italic text-ink-faint">{String(tanda.num).padStart(2, '0')}</span>
                <div>
                  <h2 class="font-medium text-2xl text-ink mb-1">{tanda.orchestra}</h2>
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-widest
                      {tanda.genre === 'Tango' ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400' :
                       tanda.genre === 'Milonga' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' :
                       'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'}">
                      {tanda.genre}
                    </span>
                    <span class="text-xs font-medium text-ink-muted tracking-widest uppercase">
                      {tanda.songs.length} tracks
                      {#if singers} &bull; {singers}{/if}
                      {#if yr} &bull; {yr}{/if}
                    </span>
                  </div>
                  {#if tanda.description}
                    <p class="text-xs text-ink-faint italic mt-1">{tanda.description}</p>
                  {/if}
                </div>
              </div>

              <button
                onclick={() => openPlayer(i)}
                class="text-sm font-medium px-6 py-3 rounded-full border border-black/10 dark:border-white/10 hover:border-black/30 dark:hover:border-white/30 hover:bg-black/5 dark:hover:bg-white/5 transition-all w-full md:w-auto cursor-pointer bg-transparent font-sans"
              >
                Open Player
              </button>
            </div>

            <!-- Song list -->
            <div class="pl-14 space-y-3">
              {#each tanda.songs as song, si}
                <div class="flex justify-between items-center text-sm gap-4">
                  <span class="text-ink/80 dark:text-ink-muted">{si + 1}. {song.title}</span>
                  <div class="flex items-center gap-3 shrink-0">
                    {#if song.singer}
                      <span class="text-ink-muted text-xs italic">{song.singer}</span>
                    {:else}
                      <span class="text-ink-faint text-[10px] italic">Instr.</span>
                    {/if}
                    {#if song.year}
                      <span class="text-ink-faint text-xs font-mono tabular-nums">{song.year}</span>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>

            <!-- Tanda comments -->
            <div class="pl-14 mt-6">
              <button
                onclick={() => expandedTandaComments = { ...expandedTandaComments, [i]: !isExpanded }}
                class="flex items-center gap-2 text-xs font-medium text-ink-muted hover:text-ink tracking-widest uppercase cursor-pointer bg-transparent border-none font-sans transition-colors group"
              >
                <MessageCircle class="w-3.5 h-3.5" />
                {tandaComments.length > 0 ? `${tandaComments.length} comment${tandaComments.length > 1 ? 's' : ''}` : 'Add comment'}
                <ChevronDown class="w-3 h-3 transition-transform {isExpanded ? 'rotate-180' : ''}" />
              </button>

              {#if isExpanded}
                <div class="mt-4 space-y-4">
                  {#if tandaComments.length > 0}
                    <div class="space-y-3">
                      {#each tandaComments as comment}
                        <div class="flex gap-3 group/comment">
                          {#if comment.authorPhoto}
                            <img src={comment.authorPhoto} alt="" class="w-7 h-7 rounded-full object-cover shrink-0" />
                          {:else}
                            <div class="w-7 h-7 rounded-full bg-black/5 dark:bg-white/5 shrink-0 flex items-center justify-center text-[10px] font-medium text-ink-muted">
                              {comment.authorName?.charAt(0).toUpperCase() ?? '?'}
                            </div>
                          {/if}
                          <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2 mb-0.5">
                              <span class="text-xs font-medium text-ink">{comment.authorName}</span>
                              <span class="text-[10px] text-ink-faint">{formatDate(comment.created_at)}</span>
                              {#if authState.user?.uid === comment.authorId && comment.id}
                                <button
                                  onclick={() => handleDeleteComment(comment.id!)}
                                  class="opacity-0 group-hover/comment:opacity-100 transition-opacity cursor-pointer bg-transparent border-none p-0 ml-auto"
                                >
                                  <Trash2 class="w-3 h-3 text-ink-faint hover:text-tango transition-colors" />
                                </button>
                              {/if}
                            </div>
                            <p class="text-sm text-ink-muted leading-relaxed">{comment.text}</p>
                          </div>
                        </div>
                      {/each}
                    </div>
                  {/if}

                  <!-- Tanda comment input -->
                  {#if authState.isLoggedIn && practicaSet.id !== 'demo'}
                    <div class="flex items-center gap-2">
                      <input
                        type="text"
                        class="flex-1 bg-transparent border-b border-black/10 dark:border-white/10 focus:border-ink dark:focus:border-white text-sm text-ink py-2 outline-none transition-colors font-sans placeholder:text-ink-faint"
                        placeholder="Share your thoughts on this tanda..."
                        bind:value={tandaCommentTexts[i]}
                        onkeydown={(e: KeyboardEvent) => e.key === 'Enter' && postTandaComment(i)}
                      />
                      <button
                        onclick={() => postTandaComment(i)}
                        disabled={sendingTandaComment[i] || !tandaCommentTexts[i]?.trim()}
                        class="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer bg-transparent border-none transition-colors disabled:opacity-30 disabled:cursor-default"
                      >
                        <Send class="w-4 h-4 text-ink-muted" />
                      </button>
                    </div>
                  {:else if !authState.isLoggedIn}
                    <p class="text-xs text-ink-faint italic">Sign in to leave a comment.</p>
                  {/if}
                </div>
              {/if}
            </div>
          </div>

          {#if i < practicaSet.tandas.length - 1}
            <hr class="border-black/5 dark:border-white/5" />
          {/if}
        {/each}
      </div>

      <!-- Set-level comments -->
      <div class="mt-24 pt-16 border-t border-black/10 dark:border-white/10">
        <button
          onclick={() => showSetComments = !showSetComments}
          class="flex items-center gap-3 mb-8 cursor-pointer bg-transparent border-none font-sans group"
        >
          <MessageCircle class="w-5 h-5 text-ink-muted" />
          <h2 class="font-serif text-3xl text-ink">Discussion</h2>
          {#if setLevelComments.length > 0}
            <span class="text-xs font-medium px-2.5 py-0.5 rounded-full bg-black/5 dark:bg-white/5 text-ink-muted">{setLevelComments.length}</span>
          {/if}
          <ChevronDown class="w-4 h-4 text-ink-faint transition-transform {showSetComments ? 'rotate-180' : ''}" />
        </button>

        {#if showSetComments}
          <!-- Set comment input at top -->
          {#if authState.isLoggedIn && practicaSet.id !== 'demo'}
            <div class="mb-8 p-6 rounded-2xl border border-black/5 dark:border-white/5 bg-card">
              <textarea
                class="w-full bg-transparent text-sm text-ink outline-none resize-none font-sans placeholder:text-ink-faint leading-relaxed"
                rows="3"
                placeholder="Share your thoughts on this set — what works, what doesn't, suggestions..."
                bind:value={newSetComment}
              ></textarea>
              <div class="flex justify-end mt-3">
                <button
                  onclick={postSetComment}
                  disabled={sendingSetComment || !newSetComment.trim()}
                  class="px-5 py-2 rounded-full bg-ink text-primary-foreground text-xs font-medium tracking-wide cursor-pointer border-none font-sans transition-opacity hover:opacity-80 disabled:opacity-30 disabled:cursor-default"
                >
                  {sendingSetComment ? 'Posting...' : 'Post Comment'}
                </button>
              </div>
            </div>
          {:else if !authState.isLoggedIn}
            <p class="text-sm text-ink-faint italic mb-8">Sign in to join the discussion.</p>
          {/if}

          {#if setLevelComments.length === 0}
            <p class="text-sm text-ink-faint font-light">No comments yet. Be the first to share your thoughts.</p>
          {:else}
            <div class="space-y-6">
              {#each setLevelComments as comment}
                <div class="flex gap-4 group/comment">
                  {#if comment.authorPhoto}
                    <img src={comment.authorPhoto} alt="" class="w-9 h-9 rounded-full object-cover shrink-0" />
                  {:else}
                    <div class="w-9 h-9 rounded-full bg-black/5 dark:bg-white/5 shrink-0 flex items-center justify-center text-xs font-medium text-ink-muted">
                      {comment.authorName?.charAt(0).toUpperCase() ?? '?'}
                    </div>
                  {/if}
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-3 mb-1">
                      <span class="text-sm font-medium text-ink">{comment.authorName}</span>
                      <span class="text-xs text-ink-faint">{formatDate(comment.created_at)}</span>
                      {#if authState.user?.uid === comment.authorId && comment.id}
                        <button
                          onclick={() => handleDeleteComment(comment.id!)}
                          class="opacity-0 group-hover/comment:opacity-100 transition-opacity cursor-pointer bg-transparent border-none p-0 ml-auto"
                        >
                          <Trash2 class="w-3.5 h-3.5 text-ink-faint hover:text-tango transition-colors" />
                        </button>
                      {/if}
                    </div>
                    <p class="text-sm text-ink-muted leading-relaxed">{comment.text}</p>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        {/if}
      </div>
    </div>
  {/if}
</div>
