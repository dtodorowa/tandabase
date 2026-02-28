<script lang="ts">
  import { player } from '$lib/stores/player.svelte';
  import GenreBadge from '$lib/components/shared/GenreBadge.svelte';
  import TandaComments from '$lib/components/player/TandaComments.svelte';
  import type { Comment } from '$lib/types';

  let { comments = [], isOwner = false, setId = '', oncommentadded }: {
    comments?: Comment[];
    isOwner?: boolean;
    setId?: string;
    oncommentadded?: () => void;
  } = $props();

  let view = $state<'player' | 'list'>('player');
  let shareOpen = $state(false);
  let linkCopied = $state(false);

  const tanda = $derived(player.currentTanda);
  const song = $derived(player.currentSong);

  function selectTanda(i: number) {
    player.selectTanda(i);
    view = 'player';
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href);
    linkCopied = true;
    setTimeout(() => { linkCopied = false; }, 2000);
  }

  function shareToFacebook() {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`, '_blank', 'width=600,height=400');
    shareOpen = false;
  }

  function shareToTwitter() {
    const text = player.set ? `Check out "${player.set.title}" on Tandabase` : 'Check out this tanda set';
    window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(text)}`, '_blank', 'width=600,height=400');
    shareOpen = false;
  }

  function shareToWhatsApp() {
    const text = player.set ? `Check out "${player.set.title}" on Tandabase: ${window.location.href}` : window.location.href;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    shareOpen = false;
  }
</script>

<div class="mobile-player">
  <!-- View Toggle -->
  <div class="view-toggle">
    <button class:active={view === 'player'} onclick={() => view = 'player'}>Now Playing</button>
    <button class:active={view === 'list'} onclick={() => view = 'list'}>Tandas</button>
  </div>

  <!-- Content -->
  {#if view === 'player'}
    <div class="player-content">
      <!-- Video -->
      <div class="video-wrap">
        {#if song?.video_id}
          <iframe
            src="https://www.youtube.com/embed/{song.video_id}?rel=0"
            allow="encrypted-media"
            allowfullscreen
            title={song.title}
          ></iframe>
        {:else}
          <div class="no-video">
            <span>No video</span>
          </div>
        {/if}
      </div>

      <!-- Tanda info + nav arrows -->
      {#if tanda}
        <div class="tanda-info">
          <div class="tanda-info-left">
            <div class="tanda-meta-row">
              <span class="tanda-num">TANDA {String(tanda.num ?? (player.currentTandaIndex + 1)).padStart(2, '0')}</span>
              <GenreBadge genre={tanda.genre} size="sm" />
            </div>
            <h2 class="tanda-orchestra">{tanda.orchestra}</h2>
            <p class="tanda-sub">{tanda.songs.length} songs</p>
          </div>
          <div class="tanda-actions">
            <button class="share-trigger" onclick={() => shareOpen = !shareOpen} aria-label="Share">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>
              </svg>
            </button>
            <button class="nav-arrow" disabled={player.currentTandaIndex === 0} onclick={() => selectTanda(player.currentTandaIndex - 1)}>&#8249;</button>
            <button class="nav-arrow" disabled={player.currentTandaIndex === player.tandas.length - 1} onclick={() => selectTanda(player.currentTandaIndex + 1)}>&#8250;</button>
          </div>
        </div>

        <!-- Share popup -->
        {#if shareOpen}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div class="share-backdrop" onclick={() => shareOpen = false} onkeydown={() => shareOpen = false}></div>
          <div class="share-popup">
            <div class="share-header">
              <span>Share this set</span>
              <button class="share-close" onclick={() => shareOpen = false}>&#10005;</button>
            </div>
            <button class="share-option" onclick={copyLink}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
              <span>{linkCopied ? 'Copied!' : 'Copy link'}</span>
            </button>
            <button class="share-option" onclick={shareToWhatsApp}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              <span>WhatsApp</span>
            </button>
            <button class="share-option" onclick={shareToFacebook}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              <span>Facebook</span>
            </button>
            <button class="share-option" onclick={shareToTwitter}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              <span>X / Twitter</span>
            </button>
          </div>
        {/if}

        <!-- Song list -->
        <div class="song-list">
          {#each tanda.songs as s, i (s.id ?? i)}
            {@const active = i === player.currentSongIndex}
            <button class="song-row" class:active onclick={() => player.selectSong(i)}>
              <div class="song-idx" class:active>
                {#if active}
                  <span class="eq"><span></span><span></span><span></span></span>
                {:else}
                  {i + 1}
                {/if}
              </div>
              <div class="song-info">
                <div class="song-title">{s.title}</div>
                {#if s.singer}
                  <div class="song-singer">{s.singer}</div>
                {/if}
              </div>
              {#if s.year}
                <span class="song-year">{s.year}</span>
              {/if}
            </button>
          {/each}
        </div>

        <!-- Comments -->
        {#if setId}
          <div class="comments-section">
            <TandaComments
              {comments}
              {setId}
              tandaIndex={player.currentTandaIndex}
              oncommentadded={() => oncommentadded?.()}
            />
          </div>
        {/if}
      {/if}
    </div>

  {:else}
    <!-- Tandas List -->
    <div class="tandas-list">
      {#each player.tandas as t, i (t.id ?? i)}
        {@const active = i === player.currentTandaIndex}
        <button class="tanda-item" class:active onclick={() => selectTanda(i)}>
          <div class="tanda-item-num" class:active>
            {String(t.num ?? i + 1).padStart(2, '0')}
          </div>
          <div class="tanda-item-info">
            <div class="tanda-item-name">{t.orchestra}</div>
            <div class="tanda-item-meta">
              <GenreBadge genre={t.genre} size="sm" />
              <span class="tanda-item-count">{t.songs.length} songs</span>
            </div>
          </div>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .mobile-player {
    display: flex;
    flex-direction: column;
    height: calc(100dvh - 56px);
    background: var(--bg);
    overflow: hidden;
  }

  /* ── View Toggle ── */
  .view-toggle {
    display: flex;
    gap: 4px;
    padding: 0.6rem 0.75rem 0.4rem;
    flex-shrink: 0;
  }
  .view-toggle button {
    flex: 1;
    padding: 0.45rem 0;
    border: none;
    border-radius: 8px;
    font-family: 'Outfit', sans-serif;
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    background: transparent;
    color: var(--text-dim);
  }
  .view-toggle button.active {
    background: var(--accent-dim);
    color: var(--accent);
  }

  /* ── Player Content ── */
  .player-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    overflow-x: hidden;
  }

  /* Video */
  .video-wrap {
    width: 100%;
    aspect-ratio: 16/9;
    background: #000;
    flex-shrink: 0;
  }
  .video-wrap iframe {
    width: 100%;
    height: 100%;
    border: none;
  }
  .no-video {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-dim);
    font-size: var(--fs-xs);
  }

  /* Tanda Info */
  .tanda-info {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 0.8rem 1rem 0;
    flex-shrink: 0;
  }
  .tanda-info-left {
    flex: 1;
    min-width: 0;
  }
  .tanda-meta-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.3rem;
  }
  .tanda-num {
    font-size: 0.625rem;
    font-weight: 700;
    color: var(--text-dim);
    letter-spacing: 0.06em;
  }
  .tanda-orchestra {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 1.15rem;
    font-weight: 600;
    color: var(--text);
    margin: 0;
    line-height: 1.2;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tanda-sub {
    font-size: 0.75rem;
    color: var(--text-dim);
    margin: 0.15rem 0 0;
  }
  .tanda-actions {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
    margin-top: 0.2rem;
    align-items: center;
  }
  .share-trigger {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text-mid);
    cursor: pointer;
    transition: all 0.15s;
    margin-right: 2px;
  }
  .share-trigger:active { transform: scale(0.9); }

  /* ── Share Popup ── */
  .share-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.4);
    z-index: 200;
  }
  .share-popup {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 201;
    background: var(--surface);
    border-top: 1px solid var(--border);
    border-radius: 16px 16px 0 0;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    animation: slideUp 0.25s ease-out;
  }
  @keyframes slideUp {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }
  .share-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 0.6rem;
    margin-bottom: 0.25rem;
    border-bottom: 1px solid var(--border);
  }
  .share-header span {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--text);
  }
  .share-close {
    background: none;
    border: none;
    color: var(--text-dim);
    font-size: 1rem;
    cursor: pointer;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
  }
  .share-close:active { background: var(--surface2); }
  .share-option {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    padding: 0.7rem 0.5rem;
    border: none;
    background: none;
    color: var(--text);
    font-family: 'Outfit', sans-serif;
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    border-radius: 10px;
    transition: background 0.12s;
    width: 100%;
    text-align: left;
  }
  .share-option:active { background: var(--surface2); }
  .share-option svg { flex-shrink: 0; color: var(--text-mid); }
  .nav-arrow {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text-mid);
    font-size: 1.1rem;
    cursor: pointer;
    transition: all 0.15s;
  }
  .nav-arrow:active:not(:disabled) { transform: scale(0.9); }
  .nav-arrow:disabled { opacity: 0.2; cursor: default; }

  /* Song List */
  .song-list {
    padding: 0.6rem 0.75rem;
    flex: 1;
  }
  .song-row {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    padding: 0.6rem 0.7rem;
    border-radius: 10px;
    margin-bottom: 2px;
    cursor: pointer;
    background: transparent;
    border: none;
    width: 100%;
    text-align: left;
    color: var(--text);
    font-family: 'Outfit', sans-serif;
    transition: background 0.15s;
  }
  .song-row:active { background: var(--surface2); }
  .song-row.active {
    background: var(--accent-dim);
  }
  .song-idx {
    width: 26px;
    height: 26px;
    border-radius: 7px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--surface2);
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--text-dim);
  }
  .song-idx.active {
    background: var(--accent-dim);
    color: var(--accent);
  }

  /* EQ animation */
  .eq {
    display: flex;
    align-items: flex-end;
    justify-content: center;
    gap: 2px;
    height: 12px;
  }
  .eq span {
    width: 2.5px;
    background: var(--accent);
    border-radius: 1px;
    animation: eq 0.7s ease-in-out infinite alternate;
  }
  .eq span:nth-child(1) { height: 35%; animation-delay: 0s; }
  .eq span:nth-child(2) { height: 80%; animation-delay: 0.15s; }
  .eq span:nth-child(3) { height: 50%; animation-delay: 0.3s; }
  @keyframes eq {
    0% { height: 30%; }
    100% { height: 100%; }
  }

  .song-info {
    flex: 1;
    min-width: 0;
  }
  .song-title {
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .song-row.active .song-title { color: var(--accent-bright, var(--accent)); }
  .song-singer {
    font-size: 0.7rem;
    color: var(--text-dim);
    margin-top: 1px;
  }
  .song-year {
    font-size: 0.75rem;
    color: var(--text-dim);
    flex-shrink: 0;
    font-variant-numeric: tabular-nums;
  }

  /* ── Comments ── */
  .comments-section {
    padding: 0.4rem 0.75rem 1rem;
    border-top: 1px solid var(--border);
    margin-top: 0.25rem;
  }

  /* ── Tandas List ── */
  .tandas-list {
    flex: 1;
    overflow-y: auto;
    padding: 0.25rem 0.75rem;
  }
  .tanda-item {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    padding: 0.7rem;
    border-radius: 12px;
    margin-bottom: 2px;
    cursor: pointer;
    background: transparent;
    border: none;
    width: 100%;
    text-align: left;
    color: var(--text);
    font-family: 'Outfit', sans-serif;
    transition: all 0.15s;
  }
  .tanda-item:active { transform: scale(0.98); }
  .tanda-item.active {
    background: var(--accent-dim);
  }
  .tanda-item-num {
    width: 34px;
    height: 34px;
    border-radius: 9px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--surface2);
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--text-dim);
  }
  .tanda-item-num.active {
    background: var(--accent);
    color: var(--bg);
  }
  .tanda-item-info {
    flex: 1;
    min-width: 0;
  }
  .tanda-item-name {
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tanda-item.active .tanda-item-name { color: var(--accent-bright, var(--accent)); }
  .tanda-item-meta {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin-top: 0.2rem;
  }
  .tanda-item-count {
    font-size: 0.7rem;
    color: var(--text-dim);
  }
</style>
