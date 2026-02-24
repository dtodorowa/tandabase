import type { PracticaSet, Tanda, Song, Genre } from '$lib/types';
import { createSet, updateSet } from '$lib/firebase/db';

function generateId(): string {
  return crypto.randomUUID();
}

function createEmptyTanda(num: number): Tanda {
  return { id: generateId(), num, orchestra: '', genre: 'Tango', songs: [] };
}

class EditorState {
  setId = $state<string | null>(null);
  title = $state('');
  description = $state('');
  cover_image = $state('');
  visibility = $state<'private' | 'public'>('private');
  tandas = $state<Tanda[]>([createEmptyTanda(1)]);
  saving = $state(false);

  tandaCount = $derived(this.tandas.length);
  songCount = $derived(this.tandas.reduce((sum, t) => sum + t.songs.length, 0));
  genreSummary = $derived([...new Set(this.tandas.map(t => t.genre))]);

  reset() {
    this.setId = null;
    this.title = '';
    this.description = '';
    this.cover_image = '';
    this.visibility = 'private';
    this.tandas = [createEmptyTanda(1)];
  }

  loadExisting(set: PracticaSet) {
    this.setId = set.id ?? null;
    this.title = set.title;
    this.description = set.description;
    this.cover_image = set.cover_image ?? '';
    this.visibility = set.visibility;
    this.tandas = structuredClone(set.tandas);
  }

  addTanda() {
    this.tandas = [...this.tandas, createEmptyTanda(this.tandas.length + 1)];
  }

  removeTanda(tandaId: string) {
    this.tandas = this.tandas
      .filter(t => t.id !== tandaId)
      .map((t, i) => ({ ...t, num: i + 1 }));
  }

  addSongToTanda(tandaId: string, song: Song) {
    this.tandas = this.tandas.map(t =>
      t.id === tandaId ? { ...t, songs: [...t.songs, song] } : t
    );
  }

  removeSongFromTanda(tandaId: string, songId: string) {
    this.tandas = this.tandas.map(t =>
      t.id === tandaId ? { ...t, songs: t.songs.filter(s => s.id !== songId) } : t
    );
  }

  updateTanda(tandaId: string, updates: Partial<Tanda>) {
    this.tandas = this.tandas.map(t =>
      t.id === tandaId ? { ...t, ...updates } : t
    );
  }

  updateSong(tandaId: string, songId: string, updates: Partial<Song>) {
    this.tandas = this.tandas.map(t =>
      t.id === tandaId
        ? { ...t, songs: t.songs.map(s => s.id === songId ? { ...s, ...updates } : s) }
        : t
    );
  }

  reorderTandas(fromIndex: number, toIndex: number) {
    const arr = [...this.tandas];
    const [moved] = arr.splice(fromIndex, 1);
    arr.splice(toIndex, 0, moved);
    this.tandas = arr.map((t, i) => ({ ...t, num: i + 1 }));
  }

  reorderSongs(tandaId: string, fromIndex: number, toIndex: number) {
    this.tandas = this.tandas.map(t => {
      if (t.id !== tandaId) return t;
      const songs = [...t.songs];
      const [moved] = songs.splice(fromIndex, 1);
      songs.splice(toIndex, 0, moved);
      return { ...t, songs };
    });
  }

  async save(authorId: string, authorName: string): Promise<string> {
    this.saving = true;
    try {
      const data = {
        title: this.title,
        description: this.description,
        ...(this.cover_image ? { cover_image: this.cover_image } : {}),
        authorId,
        authorName,
        visibility: this.visibility,
        genre_summary: this.genreSummary,
        tanda_count: this.tandaCount,
        song_count: this.songCount,
        tandas: this.tandas,
      } satisfies Omit<PracticaSet, 'id' | 'created_at' | 'updated_at'>;

      if (this.setId) {
        await updateSet(this.setId, data);
        return this.setId;
      } else {
        const id = await createSet(data);
        this.setId = id;
        return id;
      }
    } finally {
      this.saving = false;
    }
  }
}

export const editor = new EditorState();
