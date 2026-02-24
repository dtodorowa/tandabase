/**
 * Convert parsed Apple Music plist data into tanda structures.
 * Cortina tracks (genre containing "Pausen" or "Cortina") act as tanda separators.
 */

import type { PlistTrack, PlistPlaylist, PlistLibrary } from './plist-parser';
import type { Genre } from '$lib/types';

export interface ImportedSong {
  title: string;
  artist: string;
  singer: string | null;
  year: number | null;
  composer: string;
  searchQuery: string;
  // Filled after YouTube search
  video_id: string;
  video_title: string;
  thumbnail: string;
  searchStatus: 'pending' | 'searching' | 'found' | 'not_found' | 'error';
}

export interface ImportedTanda {
  num: number;
  orchestra: string;
  genre: Genre;
  songs: ImportedSong[];
}

export interface ImportResult {
  playlistName: string;
  tandas: ImportedTanda[];
  cortinas: PlistTrack[];
  skippedTracks: PlistTrack[];
}

/**
 * Detect if a track is a cortina/pause based on genre field.
 * Apple Music genre field uses patterns like "4 Pausen & Cortinas".
 */
function isCortina(track: PlistTrack): boolean {
  const g = track.genre.toLowerCase();
  return g.includes('pausen') || g.includes('cortina') || g.includes('pause');
}

/**
 * Parse the genre from Apple Music's genre field.
 * Formats: "1 Tango", "2 Milonga", "3 Vals", etc.
 */
function parseGenre(genreStr: string): Genre {
  const lower = genreStr.toLowerCase();
  if (lower.includes('milonga')) return 'Milonga';
  if (lower.includes('vals')) return 'Vals';
  return 'Tango';
}

/**
 * Extract orchestra name from artist field.
 * Apple Music format: "Di Sarli, Carlos" → "Di Sarli"
 * Also handles: "D'Arienzo, Juan" → "D'Arienzo"
 */
function parseOrchestra(artist: string): string {
  if (!artist) return '';
  // If comma-separated, take the surname (first part)
  if (artist.includes(',')) {
    return artist.split(',')[0].trim();
  }
  return artist.trim();
}

/**
 * Build a YouTube search query for a tango song.
 */
function buildSearchQuery(song: ImportedSong, orchestra: string): string {
  const parts = [song.title, orchestra];
  if (song.singer) parts.push(song.singer);
  if (song.year) parts.push(String(song.year));
  parts.push('tango');
  return parts.join(' ');
}

/**
 * Convert a playlist from a parsed plist library into tanda structures.
 * Splits on cortina tracks to detect tanda boundaries.
 */
export function importPlaylist(library: PlistLibrary, playlist: PlistPlaylist): ImportResult {
  const cortinas: PlistTrack[] = [];
  const skippedTracks: PlistTrack[] = [];

  // Resolve track IDs to actual tracks in playlist order
  const orderedTracks: (PlistTrack & { isCortina: boolean })[] = [];
  for (const trackId of playlist.trackIds) {
    const track = library.tracks.get(trackId);
    if (!track) {
      continue; // Track not in library (shouldn't happen)
    }
    const cortina = isCortina(track);
    if (cortina) cortinas.push(track);
    orderedTracks.push({ ...track, isCortina: cortina });
  }

  // Split into groups by cortinas
  const groups: PlistTrack[][] = [];
  let currentGroup: PlistTrack[] = [];

  for (const track of orderedTracks) {
    if (track.isCortina) {
      if (currentGroup.length > 0) {
        groups.push(currentGroup);
        currentGroup = [];
      }
    } else {
      currentGroup.push(track);
    }
  }
  // Don't forget the last group
  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  // Convert each group to a tanda
  const tandas: ImportedTanda[] = groups.map((tracks, index) => {
    // Determine orchestra from most common artist in the group
    const artistCounts = new Map<string, number>();
    for (const t of tracks) {
      const orch = parseOrchestra(t.artist);
      artistCounts.set(orch, (artistCounts.get(orch) ?? 0) + 1);
    }
    const orchestra = [...artistCounts.entries()]
      .sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';

    // Determine genre from most common genre in the group
    const genreCounts = new Map<Genre, number>();
    for (const t of tracks) {
      const g = parseGenre(t.genre);
      genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1);
    }
    const genre: Genre = [...genreCounts.entries()]
      .sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Tango';

    const songs: ImportedSong[] = tracks.map(t => {
      const singer = t.comments || null; // Comments field = singer
      const song: ImportedSong = {
        title: t.name,
        artist: t.artist,
        singer,
        year: t.year,
        composer: t.composer,
        searchQuery: '',
        video_id: '',
        video_title: '',
        thumbnail: '',
        searchStatus: 'pending',
      };
      song.searchQuery = buildSearchQuery(song, orchestra);
      return song;
    });

    return {
      num: index + 1,
      orchestra,
      genre,
      songs,
    };
  });

  return {
    playlistName: playlist.name,
    tandas,
    cortinas,
    skippedTracks,
  };
}
