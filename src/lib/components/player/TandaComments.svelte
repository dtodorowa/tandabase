<script lang="ts">
  import { authState } from '$lib/stores/auth.svelte';
  import { createComment, deleteComment } from '$lib/firebase/db';
  import type { Comment } from '$lib/types';

  let { comments, setId, tandaIndex, oncommentadded }:
    { comments: Comment[]; setId: string; tandaIndex: number; oncommentadded: () => void } = $props();

  let newText = $state('');
  let sending = $state(false);
  let expanded = $state(false);

  let tandaComments = $derived(
    comments.filter(c => c.tandaIndex === tandaIndex)
  );

  async function handleSubmit() {
    if (!newText.trim() || !authState.user) return;
    sending = true;
    try {
      await createComment({
        setId,
        tandaIndex,
        authorId: authState.user.uid,
        authorName: authState.user.displayName || 'Anonymous',
        authorPhoto: authState.user.photoURL || null,
        text: newText.trim(),
      });
      newText = '';
      oncommentadded();
    } catch (e) {
      console.error('Failed to post comment:', e);
    } finally {
      sending = false;
    }
  }

  async function handleDelete(commentId: string) {
    try {
      await deleteComment(commentId);
      oncommentadded();
    } catch (e) {
      console.error('Failed to delete comment:', e);
    }
  }

  function formatDate(d: any): string {
    if (!d) return '';
    const date = d.toDate ? d.toDate() : (d instanceof Date ? d : new Date(d));
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
</script>

<div class="tanda-comments">
  <button class="comments-toggle" onclick={() => expanded = !expanded}>
    <span class="comments-icon">&#128172;</span>
    {#if tandaComments.length > 0}
      <span class="comments-count">{tandaComments.length}</span>
    {/if}
    <span class="comments-label">{expanded ? 'Hide' : 'Comments'}</span>
  </button>

  {#if expanded}
    <div class="comments-body">
      {#if tandaComments.length === 0}
        <div class="no-comments">No comments yet on this tanda.</div>
      {:else}
        <div class="comment-list">
          {#each tandaComments as comment}
            <div class="comment">
              <div class="comment-header">
                {#if comment.authorPhoto}
                  <img src={comment.authorPhoto} alt="" class="comment-avatar" />
                {:else}
                  <div class="comment-avatar-placeholder">{comment.authorName.charAt(0).toUpperCase()}</div>
                {/if}
                <span class="comment-author">{comment.authorName}</span>
                <span class="comment-date">{formatDate(comment.created_at)}</span>
                {#if authState.user?.uid === comment.authorId}
                  <button class="comment-delete" onclick={() => comment.id && handleDelete(comment.id)} title="Delete">&#10005;</button>
                {/if}
              </div>
              <div class="comment-text">{comment.text}</div>
            </div>
          {/each}
        </div>
      {/if}

      {#if authState.isLoggedIn}
        <div class="comment-form">
          <input
            type="text"
            class="comment-input"
            placeholder="Add a comment on this tanda..."
            bind:value={newText}
            onkeydown={(e) => e.key === 'Enter' && handleSubmit()}
          />
          <button class="comment-send" onclick={handleSubmit} disabled={sending || !newText.trim()}>
            {sending ? '...' : 'Post'}
          </button>
        </div>
      {:else}
        <div class="comment-login-hint">Sign in to leave a comment.</div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .tanda-comments {
    width: 100%;
  }
  .comments-toggle {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    background: none;
    border: none;
    color: var(--text-dim);
    font-size: 1rem;
    font-family: 'Outfit', sans-serif;
    cursor: pointer;
    padding: 0.3rem 0;
    transition: color 0.12s;
  }
  .comments-toggle:hover { color: var(--accent); }
  .comments-icon { font-size: 1.25rem; }
  .comments-count {
    background: var(--accent-dim);
    color: var(--accent);
    padding: 0.05rem 0.35rem;
    border-radius: 99px;
    font-size: 0.8rem;
    font-weight: 600;
  }
  .comments-label {
    font-weight: 500;
  }

  .comments-body {
    margin-top: 0.4rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .no-comments {
    font-size: 1rem;
    color: var(--text-dim);
    padding: 0.3rem 0;
    font-style: italic;
  }

  .comment-list {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    max-height: 250px;
    overflow-y: auto;
  }
  .comment {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 0.45rem 0.6rem;
  }
  .comment-header {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    margin-bottom: 0.15rem;
  }
  .comment-avatar {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
  }
  .comment-avatar-placeholder {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--accent-dim);
    color: var(--accent);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.55rem;
    font-weight: 600;
    flex-shrink: 0;
  }
  .comment-author {
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--text);
  }
  .comment-date {
    font-size: 0.7rem;
    color: var(--text-dim);
    margin-left: auto;
  }
  .comment-delete {
    background: none;
    border: none;
    color: var(--text-dim);
    font-size: 0.6rem;
    cursor: pointer;
    padding: 0 0.2rem;
    opacity: 0.5;
    transition: all 0.12s;
  }
  .comment-delete:hover { color: var(--tango); opacity: 1; }
  .comment-text {
    font-size: 0.85rem;
    color: var(--text-mid);
    line-height: 1.45;
  }

  .comment-form {
    display: flex;
    gap: 0.3rem;
  }
  .comment-input {
    flex: 1;
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--text);
    border-radius: var(--radius-sm);
    padding: 0.35rem 0.55rem;
    font-size: 0.9rem;
    font-family: 'Outfit', sans-serif;
  }
  .comment-input:focus { border-color: var(--accent); outline: none; }
  .comment-send {
    background: var(--accent);
    color: var(--bg);
    border: none;
    padding: 0.35rem 0.7rem;
    font-size: 0.9rem;
    font-weight: 600;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all 0.12s;
    font-family: 'Outfit', sans-serif;
    white-space: nowrap;
  }
  .comment-send:hover:not(:disabled) { background: var(--accent-bright); }
  .comment-send:disabled { opacity: 0.5; cursor: default; }

  .comment-login-hint {
    font-size: 0.68rem;
    color: var(--text-dim);
    font-style: italic;
    padding: 0.2rem 0;
  }
</style>
