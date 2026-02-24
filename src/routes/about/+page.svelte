<svelte:head>
  <title>About - Practica Set</title>
</svelte:head>

<div class="about-page">
  <div class="about-content">
    <h1>hey, i'm daniela</h1>
    <p class="intro">
      and i built this thing because i got into a random rabbit hole
    </p>

    <section>
      <h2>what is this?</h2>
      <p>
        tandabase (yes, like database, i'm not sorry) is a <strong>listening tool</strong>
      </p> 
        
      <p>
        you build a setlist of tandas and then you listen to them, one at a time,
        learning the music as you go.
      </p>
      <p>
        it pulls videos from youtube so you can hear the actual recordings. the point is you get to <em>listen</em>.
      </p>
    </section>

  <section>
        <h2>why does it exist?</h2>
        <p class="aside">(apart from the fact that i got into a rabbit hole when i should've been working)</p>
  
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
        <p>you see where this is going? </p>
     
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
      <p class="sign-off">&mdash; daniela</p>
    </section>
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
    font-size: 1.8rem;
    font-weight: 700;
    letter-spacing: -0.03em;
    color: var(--text);
    margin-bottom: 0;
  }
  .intro {
    font-size: 1rem;
    color: var(--text-mid);
    margin-top: 0.2rem;
    margin-bottom: 1.5rem;
  }
  section {
    margin-bottom: 1.8rem;
  }
  h2 {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 1.05rem;
    font-weight: 600;
    color: var(--accent);
    letter-spacing: -0.01em;
    margin-bottom: 0.5rem;
  }
  p {
    font-size: 0.88rem;
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
    font-size: 0.85rem;
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
    font-size: 0.9rem;
    color: var(--accent);
    font-weight: 500;
    font-style: italic;
  }

  @media (max-width: 600px) {
    .about-page { padding: 1.5rem 1rem 3rem; }
    h1 { font-size: 1.4rem; }
  }
</style>
