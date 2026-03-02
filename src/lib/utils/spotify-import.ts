/**
 * Convert Spotify playlist data (from our API route) into ImportResult
 * compatible with the existing import pipeline.
 */

import type { ImportedSong, ImportedTanda, ImportResult } from './playlist-import';
import type { Genre } from '$lib/types';

export interface SpotifyTrack {
  name: string;
  artists: string[];
  album: string;
  year: number | null;
  duration_ms: number;
}

export interface SpotifyPlaylistData {
  name: string;
  description: string;
  tracks: SpotifyTrack[];
}

/**
 * Extract a Spotify playlist URL or ID for validation on the client side.
 */
export function extractPlaylistId(input: string): string | null {
  const trimmed = input.trim();
  if (/^[a-zA-Z0-9]{22}$/.test(trimmed)) return trimmed;
  const uriMatch = trimmed.match(/spotify:playlist:([a-zA-Z0-9]+)/);
  if (uriMatch) return uriMatch[1];
  try {
    const url = new URL(trimmed);
    const match = url.pathname.match(/\/playlist\/([a-zA-Z0-9]+)/);
    if (match) return match[1];
  } catch { /* not a URL */ }
  return null;
}

export function isValidSpotifyUrl(input: string): boolean {
  const trimmed = input.trim();
  if (/^[a-zA-Z0-9]{22}$/.test(trimmed)) return true;
  if (/spotify:playlist:[a-zA-Z0-9]+/.test(trimmed)) return true;
  try {
    const url = new URL(trimmed);
    return /\/playlist\/[a-zA-Z0-9]+/.test(url.pathname);
  } catch {
    return false;
  }
}

/**
 * Guess genre from track name, album name, or artist context.
 * Tango is the default; look for hints of vals or milonga.
 */
function guessGenre(track: SpotifyTrack): Genre {
  const text = `${track.name} ${track.album}`.toLowerCase();
  if (text.includes('vals')) return 'Vals';
  if (text.includes('milonga')) return 'Milonga';
  return 'Tango';
}

/**
 * Detect cortina-like tracks by name patterns.
 */
function isCortina(track: SpotifyTrack): boolean {
  const name = track.name.toLowerCase();
  return name.includes('cortina') || name.includes('pausen');
}

/**
 * Normalize a Spotify artist name to extract the core orchestra name.
 * E.g.:
 *   "Carlos Di Sarli y su Orquesta Típica" → "Carlos Di Sarli"
 *   "Carlos di Sarli, Roberto Florio" → "Carlos Di Sarli"
 *   "Carlos di Sarli, Roberto Florio, Jorge Duran" → "Carlos Di Sarli"
 *   "Orquesta Tipica Victor" → "Orquesta Tipica Victor"
 */
function normalizeArtist(artist: string): string {
  if (!artist) return '';
  let name = artist.trim();

  // Strip suffixes like "y su Orquesta Típica", "y su Orquesta", "y su Sexteto"
  name = name.replace(/\s+y\s+su\s+.+$/i, '');

  // Strip everything after a comma (additional artists / singers)
  if (name.includes(',')) {
    name = name.split(',')[0].trim();
  }

  return name;
}

/**
 * Extract singer names from additional Spotify artists beyond the first,
 * plus any names after a comma in the first artist string.
 */
function extractSingers(track: SpotifyTrack): string | null {
  const singers: string[] = [];

  // Names after comma in the first artist
  const firstArtist = track.artists[0] ?? '';
  if (firstArtist.includes(',')) {
    const parts = firstArtist.split(',').slice(1).map(s => s.trim()).filter(Boolean);
    singers.push(...parts);
  }

  // Additional artists beyond the first
  if (track.artists.length > 1) {
    singers.push(...track.artists.slice(1));
  }

  return singers.length > 0 ? singers.join(', ') : null;
}

/**
 * Build a YouTube search query for a Spotify track.
 */
function buildSearchQuery(track: SpotifyTrack, orchestra: string): string {
  const parts = [track.name, orchestra];
  const singer = extractSingers(track);
  if (singer) parts.push(singer);
  if (track.year) parts.push(String(track.year));
  parts.push('tango');
  return parts.join(' ');
}

/**
 * Convert Spotify playlist data to ImportResult.
 *
 * Strategy:
 * - Cortina tracks act as tanda separators (same as Apple Music import).
 * - If no cortinas found, group consecutive tracks by the same primary artist.
 * - The first artist is treated as the orchestra.
 */
export function spotifyToImportResult(data: SpotifyPlaylistData): ImportResult {
  const hasCortinas = data.tracks.some(isCortina);

  if (hasCortinas) {
    return splitByCortinas(data);
  }
  return splitByArtist(data);
}

function splitByCortinas(data: SpotifyPlaylistData): ImportResult {
  const groups: SpotifyTrack[][] = [];
  let current: SpotifyTrack[] = [];

  for (const track of data.tracks) {
    if (isCortina(track)) {
      if (current.length > 0) {
        groups.push(current);
        current = [];
      }
    } else {
      current.push(track);
    }
  }
  if (current.length > 0) groups.push(current);

  return buildResult(data.name, groups);
}

function splitByArtist(data: SpotifyPlaylistData): ImportResult {
  const nonCortina = data.tracks.filter(t => !isCortina(t));
  const groups: SpotifyTrack[][] = [];
  let current: SpotifyTrack[] = [];
  let currentNormalized = '';

  for (const track of nonCortina) {
    const normalized = normalizeArtist(track.artists[0] ?? '');
    if (currentNormalized && normalized.toLowerCase() !== currentNormalized.toLowerCase()) {
      if (current.length > 0) groups.push(current);
      current = [];
    }
    currentNormalized = normalized;
    current.push(track);
  }
  if (current.length > 0) groups.push(current);

  return buildResult(data.name, groups);
}

function buildResult(playlistName: string, groups: SpotifyTrack[][]): ImportResult {
  const tandas: ImportedTanda[] = groups.map((tracks, index) => {
    // Determine orchestra from most common normalized first artist
    const artistCounts = new Map<string, number>();
    for (const t of tracks) {
      const artist = normalizeArtist(t.artists[0] ?? '');
      artistCounts.set(artist, (artistCounts.get(artist) ?? 0) + 1);
    }
    const orchestra = [...artistCounts.entries()]
      .sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';

    // Determine genre
    const genreCounts = new Map<Genre, number>();
    for (const t of tracks) {
      const g = guessGenre(t);
      genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1);
    }
    const genre: Genre = [...genreCounts.entries()]
      .sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Tango';

    const songs: ImportedSong[] = tracks.map(t => {
      const singer = extractSingers(t);

      const song: ImportedSong = {
        title: t.name,
        artist: normalizeArtist(t.artists[0] ?? ''),
        singer,
        year: t.year,
        composer: '',
        searchQuery: buildSearchQuery(t, orchestra),
        video_id: '',
        video_title: '',
        thumbnail: '',
        searchStatus: 'pending',
      };
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
    playlistName,
    tandas,
    cortinas: [],
    skippedTracks: [],
  };
}
