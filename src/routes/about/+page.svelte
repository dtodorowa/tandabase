<script lang="ts">
  import { submitFeedback } from '$lib/firebase/db';
  import { authState } from '$lib/stores/auth.svelte';

  let feedbackMsg = $state('');
  let feedbackName = $state('');
  let sending = $state(false);
  let sent = $state(false);
  let sendError = $state('');

  async function handleSubmit() {
    if (!feedbackMsg.trim()) return;
    sending = true;
    sendError = '';
    try {
      await submitFeedback({
        message: feedbackMsg.trim(),
        name: feedbackName.trim() || 'Anonymous',
        userId: authState.user?.uid,
      });
      sent = true;
      feedbackMsg = '';
      feedbackName = '';
      setTimeout(() => sent = false, 5000);
    } catch (e) {
      sendError = 'Failed to send. Try again?';
    } finally {
      sending = false;
    }
  }
</script>

<svelte:head>
  <title>About - Tandabase</title>
</svelte:head>

<div class="about-page">
  <div class="about-content">

    <section>
      <h2>what is this?</h2>
      <p>
        a listening tool? an ad-less tango youtube player? idk?
      </p>
      <p>
        you build a setlist of tandas and then you listen to them, share them, and
        maybe you learn something along the way?
      </p>
      <p>
        it pulls videos from youtube so you can hear the actual recordings. the point is you get to <em>listen</em>.
      </p>
    </section>

    <section>
      <h2>how this started</h2>
      <p class="aside">(apart from the fact that i got into a rabbit hole when i should've been working)</p>

      <p>
        i had an apple music playlist of tango music (files on my computer) and i wanted a way to share it with my students.
        easiest formats to share are usually spotify or youtube playlists, but i didn't want to manually search up every single song.
      </p>
      <p>
        so i wrote a script that goes through my playlist and searches youtube for each song automatically. that part worked.
        but then i wanted to add the results to an actual youtube playlist, and youtube's api has strict limits
        that you can't get around without paying. i didn't want to deal with that.
      </p>
      <p>
        so i just kept the links and built a simple player around them. and since i had control over the whole thing,
        i could structure everything as tandas instead of just a flat list of songs.
      </p>
      <p>
        what started as a little script to automate youtube searches turned into this.
      </p>
    </section>

    <section>
      <h2>what problem could it potentially solve?</h2>
      <p>
        if you're new to tango, you don't know what to listen to. you don't know the
        orchestras. you don't know that a di sarli tanda from 1930 and a di sarli
        tanda from 1955 are basically two different genres. nobody sits you down
        and explains this. you just absorb it over years of dancing and random
        conversations with people who know.
      </p>
      <p>
        and if you've been dancing for a while? the knowledge is all there, in
        your head, in your itunes library, in some spreadsheet.
      </p>
      <p>
        experienced DJs have all this knowledge. newer dancers
        are curious but they don't know where to start. and there's nothing connecting the two.
      </p>
      <p>you see where this is going?</p>
    </section>

    <section>
      <h2>this is not for djing</h2>
      <p>
        i want to be really clear about this: <strong>this is not a dj tool</strong>. i deliberately
        designed it that way.
      </p>
      <ul>
        <li><strong>no autoplay.</strong> when a song ends, you have to manually go to the next one. this is intentional. you're here to listen, not to press play and walk away.</li>
        <li><strong>no cortina spaces.</strong> i didn't add gaps between tandas because i don't want someone to hook this up to speakers at a milonga and hit play. that's not what this is for.</li>
        <li><strong>youtube embeds, not audio files.</strong> the quality varies. some videos are great, some are okay. for listening and learning, that's fine. for a milonga, absolutely not.</li>
      </ul>
      <p>
        if you want to dj, buy the music and support the labels that preserve these recordings. we have to support the people who preserve this music.
      </p>
      <p>
        but if you want to <em>learn</em> the music: to sit with it, to start recognizing orchestras,
        to develop your ear, that's what this is for.
      </p>
    </section>

    <section>
      <h2>how it works</h2>
      <ul>
        <li><strong>browse</strong> public sets that others have shared, or create your own.</li>
        <li><strong>create</strong> sets by searching youtube for songs and organizing them into tandas.</li>
        <li><strong>import</strong> a playlist from apple music (export as xml) and it'll auto-detect your tandas and find youtube videos.</li>
        <li><strong>upload</strong> a csv if you prefer to build a set that way.</li>
        <li><strong>listen.</strong> one song at a time. pay attention to the orchestra, the singer, the year. that's the whole point.</li>
      </ul>
    </section>

    <section>
      <h2>wrong video?</h2>
      <p>
        the youtube search isn't perfect. sometimes it finds the wrong recording or a weird cover version.
        if you're the set owner, you can click "wrong video?" under the player and swap it out right there.
        if you're not the owner but you notice something's off, you can flag it and the owner will get notified.
      </p>
    </section>

    <section>
      <h2>that's it</h2>
      <p>
        i hope this makes it a little
        less confusing to get started.
      </p>
      <p class="sign-off">daniela</p>
    </section>

    <!-- ── Status / Announcements ── -->
    <div class="status-card">
      <div class="status-header">
        <span class="status-dot"></span>
        <span class="status-label">actively building</span>
      </div>
      <h2 class="status-title">what i'm working on</h2>
      <ul class="roadmap">
        <li class="done">set editor redesign (desktop)</li>
        <li class="done">desktop navigation overhaul</li>
        <li class="in-progress">mobile screens review &amp; polish</li>
        <li class="in-progress">mobile editor layout</li>
        <li class="planned">drag-and-drop improvements</li>
        <li class="planned">better search &amp; filtering on browse</li>
      </ul>
      <p class="status-note">
        this is very much a work in progress. if something looks weird or broken,
        it's probably because i haven't gotten to it yet.
        <strong>any feedback or feature requests are super appreciated!</strong>
      </p>
    </div>


    <!-- ── Feedback / Feature Request ── -->
    <div class="feedback-card">
      <h2>got ideas? found a bug?</h2>
      <p>drop me a message. feature requests, feedback, complaints, whatever. it all helps.</p>
      <form class="feedback-form" onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
        <input
          type="text"
          bind:value={feedbackName}
          placeholder="your name (optional)"
          class="feedback-input feedback-name"
        />
        <textarea
          bind:value={feedbackMsg}
          placeholder="what's on your mind?"
          class="feedback-input feedback-msg"
          rows="3"
        ></textarea>
        <div class="feedback-footer">
          {#if sent}
            <span class="feedback-success">sent! thank you</span>
          {/if}
          {#if sendError}
            <span class="feedback-error">{sendError}</span>
          {/if}
          <button
            type="submit"
            class="feedback-btn"
            disabled={sending || !feedbackMsg.trim()}
          >
            {sending ? 'sending...' : 'send'}
          </button>
        </div>
      </form>
    </div>

  </div>
</div>

<style>
  .about-page {
    max-width: 680px;
    margin: 0 auto;
    padding: 2rem 1.5rem 4rem;
  }
  .about-content {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }
  h1 {
    font-family: 'Space Grotesk', sans-serif;
    font-size: var(--fs-title);
    font-weight: 700;
    letter-spacing: -0.03em;
    color: var(--text);
    margin-bottom: 0;
  }
  .intro {
    font-size: var(--fs-body);
    color: var(--text-mid);
    margin-top: 0.2rem;
    margin-bottom: 1.5rem;
  }
  section {
    margin-bottom: 1.8rem;
  }
  h2 {
    font-family: 'Space Grotesk', sans-serif;
    font-size: var(--fs-display);
    font-weight: 600;
    color: var(--accent);
    letter-spacing: -0.01em;
    margin-bottom: 0.5rem;
  }
  p {
    font-size: var(--fs-body);
    line-height: 1.7;
    color: var(--text-mid);
    margin: 0 0 0.6rem;
  }
  ul {
    list-style: none;
    padding: 0;
    margin: 0.4rem 0 0.6rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  li {
    font-size: var(--fs-body);
    line-height: 1.65;
    color: var(--text-mid);
    padding-left: 1rem;
    position: relative;
  }
  li::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0.55em;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--accent);
  }
  li strong {
    color: var(--text);
  }
  p strong {
    color: var(--text);
  }
  p em {
    font-style: italic;
  }
  .sign-off {
    margin-top: 0.8rem;
    font-size: var(--fs-body);
    color: var(--accent);
    font-weight: 500;
    font-style: italic;
  }

  /* ── Status / Announcements card ── */
  .status-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 1.5rem;
    margin-bottom: 2rem;
  }
  .status-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.4rem;
  }
  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--vals);
    animation: pulse 2s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
  .status-label {
    font-size: var(--fs-2xs);
    font-weight: 600;
    color: var(--vals);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .status-card .status-title {
    font-size: var(--fs-subheading);
    color: var(--text);
    margin-bottom: 0.8rem;
  }
  .roadmap {
    list-style: none;
    padding: 0;
    margin: 0 0 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .roadmap li {
    font-size: var(--fs-sm);
    padding-left: 1.6rem;
    position: relative;
    color: var(--text-mid);
  }
  .roadmap li::before {
    position: absolute;
    left: 0;
    top: 0.2em;
    font-size: 0.85rem;
    width: auto;
    height: auto;
    border-radius: 0;
    background: none;
  }
  .roadmap li.done { color: var(--text-dim); text-decoration: line-through; }
  .roadmap li.done::before { content: '\2713'; color: var(--vals); }
  .roadmap li.in-progress { color: var(--text); font-weight: 500; }
  .roadmap li.in-progress::before { content: '\25B6'; color: var(--accent); font-size: 0.7rem; top: 0.35em; }
  .roadmap li.planned::before { content: '\25CB'; color: var(--text-dim); }
  .status-note {
    font-size: var(--fs-sm);
    color: var(--text-dim);
    line-height: 1.6;
    margin: 0;
  }
  .status-note strong { color: var(--accent); }

  /* ── Feedback card ── */
  .feedback-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 1.5rem;
    margin-top: 1rem;
  }
  .feedback-card h2 {
    font-size: var(--fs-subheading);
    color: var(--text);
    margin-bottom: 0.3rem;
  }
  .feedback-card p {
    font-size: var(--fs-sm);
    color: var(--text-dim);
    margin-bottom: 1rem;
  }
  .feedback-form {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  .feedback-input {
    background: var(--bg);
    border: 1px solid var(--border);
    color: var(--text);
    border-radius: var(--radius-sm);
    padding: 0.6rem 0.8rem;
    font-size: var(--fs-sm);
    font-family: 'Outfit', sans-serif;
    outline: none;
    resize: vertical;
  }
  .feedback-input:focus { border-color: var(--accent); }
  .feedback-input::placeholder { color: var(--text-dim); }
  .feedback-name { max-width: 280px; }
  .feedback-footer {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    justify-content: flex-end;
  }
  .feedback-success {
    font-size: var(--fs-xs);
    color: var(--vals);
    font-weight: 500;
  }
  .feedback-error {
    font-size: var(--fs-xs);
    color: var(--tango);
  }
  .feedback-btn {
    background: var(--accent);
    border: none;
    color: var(--bg);
    padding: 0.5rem 1.2rem;
    font-size: var(--fs-sm);
    font-weight: 600;
    font-family: 'Outfit', sans-serif;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all 0.15s;
  }
  .feedback-btn:hover:not(:disabled) { background: var(--accent-bright); }
  .feedback-btn:disabled { opacity: 0.5; cursor: default; }

  @media (max-width: 600px) {
    .about-page { padding: 1.5rem 1rem 3rem; }
    h1 { font-size: var(--fs-subheading); }
    .feedback-name { max-width: 100%; }
  }
</style>
