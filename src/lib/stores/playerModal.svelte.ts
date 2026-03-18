import type { PracticaSet } from '$lib/types';
import { player } from './player.svelte';

class PlayerModalState {
  open = $state(false);
  startTandaIndex = $state(0);

  openModal(set: PracticaSet, tandaIndex = 0) {
    player.loadSet(set);
    player.selectTanda(tandaIndex);
    this.startTandaIndex = tandaIndex;
    this.open = true;
    if (typeof document !== 'undefined') {
      document.body.style.overflow = 'hidden';
    }
  }

  close() {
    this.open = false;
    if (typeof document !== 'undefined') {
      document.body.style.overflow = 'auto';
    }
  }
}

export const playerModal = new PlayerModalState();
