import type { PracticaSet, Tanda, Song } from '$lib/types';

class PlayerState {
  set = $state<PracticaSet | null>(null);
  currentTandaIndex = $state(0);
  currentSongIndex = $state(0);

  tandas = $derived(this.set?.tandas ?? []);
  currentTanda = $derived(this.tandas[this.currentTandaIndex]);
  currentSong = $derived(this.currentTanda?.songs[this.currentSongIndex]);
  songCounter = $derived(
    `${this.currentSongIndex + 1} / ${this.currentTanda?.songs.length ?? 0}`
  );
  isFirst = $derived(this.currentTandaIndex === 0 && this.currentSongIndex === 0);
  isLast = $derived(
    this.currentTandaIndex === this.tandas.length - 1 &&
    this.currentSongIndex === (this.currentTanda?.songs.length ?? 1) - 1
  );

  loadSet(practicaSet: PracticaSet) {
    this.set = practicaSet;
    this.currentTandaIndex = 0;
    this.currentSongIndex = 0;
  }

  selectTanda(index: number) {
    this.currentTandaIndex = index;
    this.currentSongIndex = 0;
  }

  selectSong(index: number) {
    this.currentSongIndex = index;
  }

  next() {
    const tanda = this.currentTanda;
    if (!tanda) return;
    if (this.currentSongIndex < tanda.songs.length - 1) {
      this.currentSongIndex++;
    } else if (this.currentTandaIndex < this.tandas.length - 1) {
      this.currentTandaIndex++;
      this.currentSongIndex = 0;
    }
  }

  prev() {
    if (this.currentSongIndex > 0) {
      this.currentSongIndex--;
    } else if (this.currentTandaIndex > 0) {
      this.currentTandaIndex--;
      this.currentSongIndex = this.tandas[this.currentTandaIndex].songs.length - 1;
    }
  }

  replaceSongVideo(tandaIndex: number, songIndex: number, videoData: { video_id: string; video_title: string; thumbnail: string }) {
    if (!this.set) return;
    const song = this.set.tandas[tandaIndex]?.songs[songIndex];
    if (!song) return;
    song.video_id = videoData.video_id;
    song.video_title = videoData.video_title;
    song.thumbnail = videoData.thumbnail;
    // Trigger reactivity by reassigning set
    this.set = { ...this.set };
  }
}

export const player = new PlayerState();
