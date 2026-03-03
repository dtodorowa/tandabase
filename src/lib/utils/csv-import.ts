/**
 * Parse a CSV string into ImportedTanda structures.
 *
 * Expected CSV columns: orchestra, title, year, singer, genre
 * - Songs with the same consecutive orchestra are grouped into one tanda.
 * - Singer can be empty, "instrumental", or omitted → null.
 * - Genre defaults to "Tango" if omitted or unrecognised.
 * - A blank row (or a row where orchestra is empty) starts a new tanda.
 */

import type { Genre } from '$lib/types';
import type { ImportedTanda, ImportedSong, ImportResult } from './playlist-import';
import { spotifyToImportResult, type SpotifyTrack, type SpotifyPlaylistData } from './spotify-import';

export const CSV_EXAMPLE = `orchestra,title,year,singer,genre
Di Sarli,Bahía Blanca,1957,,Tango
Di Sarli,A la gran muñeca,1951,,Tango
Di Sarli,Milonguero viejo,1956,,Tango
Di Sarli,Sans Souci,1954,,Tango

D'Arienzo,El flete,1937,,Tango
D'Arienzo,La bruja,1938,,Tango
D'Arienzo,Pensalo bien,1938,,Tango
D'Arienzo,Loca,1938,,Tango

Canaro,Desde el alma,1952,Nelly Omar,Vals
Canaro,Corazón de oro,1945,Eduardo Adrián,Vals
Canaro,Yo no sé por qué razón,1953,Carlos Roldán,Vals

Pugliese,La yumba,1946,,Tango
Pugliese,Recuerdo,1956,,Tango
Pugliese,Gallo ciego,1959,,Tango
Pugliese,La mariposa,1952,,Tango`;

function normaliseGenre(raw: string): Genre {
  const lower = raw.trim().toLowerCase();
  if (lower.includes('milonga')) return 'Milonga';
  if (lower.includes('vals')) return 'Vals';
  return 'Tango';
}

function normaliseSinger(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.toLowerCase() === 'instrumental') return null;
  return trimmed;
}

function buildSearchQuery(title: string, orchestra: string, singer: string | null, year: number | null): string {
  const parts = [title, orchestra];
  if (singer) parts.push(singer);
  if (year) parts.push(String(year));
  parts.push('tango');
  return parts.join(' ');
}

/**
 * Parse raw CSV text into rows, handling quoted fields.
 */
function parseRows(text: string): string[][] {
  const lines = text.split(/\r?\n/);
  const rows: string[][] = [];

  for (const line of lines) {
    const cols: string[] = [];
    let current = '';
    let inQuote = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuote) {
        if (ch === '"' && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (ch === '"') {
          inQuote = false;
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuote = true;
        } else if (ch === ',') {
          cols.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
    }
    cols.push(current.trim());
    rows.push(cols);
  }

  return rows;
}

export interface CsvImportResult extends ImportResult {}

/**
 * Detect which CSV format we're dealing with based on the header row.
 * Returns 'exportify' | 'tandabase' | 'unknown'.
 */
type CsvFormat = 'exportify' | 'tandabase' | 'unknown';

function detectFormat(headerCols: string[]): CsvFormat {
  const lower = headerCols.map(c => c.toLowerCase().trim());

  // Exportify: "Track URI", "Track Name", "Album Name", "Artist Name(s)", ...
  if (lower.includes('track name') || lower.includes('track uri') || lower.includes('artist name(s)')) {
    return 'exportify';
  }

  // Tandabase native: orchestra, title, year, singer, genre
  if (lower.includes('orchestra') || lower.includes('title') || lower.includes('song')) {
    return 'tandabase';
  }

  return 'unknown';
}

/**
 * Build a column-index map from the header row for flexible column access.
 */
function buildColumnMap(headerCols: string[]): Map<string, number> {
  const map = new Map<string, number>();
  headerCols.forEach((col, i) => map.set(col.toLowerCase().trim(), i));
  return map;
}

/**
 * Parse an Exportify-format CSV into an ImportResult.
 * Maps: Track Name → title, Artist Name(s) → artists (;-separated),
 * Album Name → album, Release Date → year, Genres → genre hint.
 */
function parseExportifyCsv(rows: string[][], headerCols: string[]): CsvImportResult {
  const col = buildColumnMap(headerCols);

  const nameIdx = col.get('track name') ?? -1;
  const artistIdx = col.get('artist name(s)') ?? -1;
  const albumIdx = col.get('album name') ?? -1;
  const dateIdx = col.get('release date') ?? -1;
  const durationIdx = col.get('duration (ms)') ?? -1;
  const genreIdx = col.get('genres') ?? -1;

  if (nameIdx === -1 || artistIdx === -1) {
    throw new Error(
      'This looks like an Exportify CSV but is missing required columns.\n' +
      'Expected at least "Track Name" and "Artist Name(s)" columns.',
    );
  }

  const tracks: SpotifyTrack[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.every(c => c === '')) continue;

    const name = (r[nameIdx] ?? '').trim();
    if (!name) continue;

    // Artists are semicolon-separated in Exportify CSVs
    const artistsRaw = (r[artistIdx] ?? '').trim();
    const artists = artistsRaw ? artistsRaw.split(';').map(a => a.trim()).filter(Boolean) : [];

    const album = albumIdx >= 0 ? (r[albumIdx] ?? '').trim() : '';

    // Deliberately skip year — Spotify/Exportify "Release Date" is the album/reissue
    // date, not the original recording year. For tango this is wildly inaccurate
    // (e.g. a 1938 recording showing as 2011) and pollutes YouTube searches.
    const year: number | null = null;

    const duration_ms = durationIdx >= 0 ? parseInt(r[durationIdx] ?? '0', 10) || 0 : 0;

    // Use the Genres column to help with genre detection if available
    let albumWithGenreHint = album;
    if (genreIdx >= 0) {
      const genres = (r[genreIdx] ?? '').trim().toLowerCase();
      if (genres.includes('vals') || genres.includes('waltz')) {
        albumWithGenreHint += ' vals';
      } else if (genres.includes('milonga')) {
        albumWithGenreHint += ' milonga';
      }
    }

    tracks.push({ name, artists, album: albumWithGenreHint, year, duration_ms });
  }

  if (tracks.length === 0) {
    throw new Error('No tracks found in the Exportify CSV. The file appears to be empty.');
  }

  const playlistData: SpotifyPlaylistData = {
    name: '',
    description: '',
    tracks,
  };

  return spotifyToImportResult(playlistData);
}

/**
 * Parse the native tandabase CSV format: orchestra, title, year, singer, genre
 */
function parseTandabaseCsv(rows: string[][], startIndex: number): CsvImportResult {
  const tandas: ImportedTanda[] = [];
  let currentSongs: ImportedSong[] = [];
  let currentOrchestra = '';
  let currentGenre: Genre = 'Tango';

  function flushTanda() {
    if (currentSongs.length === 0) return;
    tandas.push({
      num: tandas.length + 1,
      orchestra: currentOrchestra,
      genre: currentGenre,
      songs: currentSongs,
    });
    currentSongs = [];
    currentOrchestra = '';
    currentGenre = 'Tango';
  }

  for (let i = startIndex; i < rows.length; i++) {
    const cols = rows[i];

    // Blank row → tanda separator
    if (cols.every(c => c === '')) {
      flushTanda();
      continue;
    }

    const orchestra = (cols[0] ?? '').trim();
    const title = (cols[1] ?? '').trim();
    const yearStr = (cols[2] ?? '').trim();
    const singerRaw = cols[3] ?? '';
    const genreRaw = cols[4] ?? '';

    // Skip rows without at minimum orchestra + title
    if (!orchestra || !title) {
      flushTanda();
      continue;
    }

    const year = yearStr ? parseInt(yearStr, 10) || null : null;
    const singer = normaliseSinger(singerRaw);
    const genre = genreRaw ? normaliseGenre(genreRaw) : 'Tango';

    // If orchestra changed, start a new tanda
    if (currentOrchestra && orchestra.toLowerCase() !== currentOrchestra.toLowerCase()) {
      flushTanda();
    }

    currentOrchestra = orchestra;
    currentGenre = genre;

    const song: ImportedSong = {
      title,
      artist: orchestra,
      singer,
      year,
      composer: '',
      searchQuery: buildSearchQuery(title, orchestra, singer, year),
      video_id: '',
      video_title: '',
      thumbnail: '',
      searchStatus: 'pending',
    };

    currentSongs.push(song);
  }

  // Flush remaining
  flushTanda();

  if (tandas.length === 0) {
    throw new Error('No tandas found. Check that your CSV has at least orchestra and title columns.');
  }

  return {
    playlistName: '',
    tandas,
    cortinas: [],
    skippedTracks: [],
  };
}

export function parseCsvToTandas(csvText: string): CsvImportResult {
  const rows = parseRows(csvText);
  if (rows.length === 0) throw new Error('CSV is empty');

  const firstRow = rows[0];
  const format = detectFormat(firstRow);

  switch (format) {
    case 'exportify':
      return parseExportifyCsv(rows, firstRow);

    case 'tandabase': {
      // Skip the header row
      return parseTandabaseCsv(rows, 1);
    }

    case 'unknown': {
      // Try to be helpful: check if the first data row looks like it could
      // work without headers (orchestra, title pattern)
      const probe = rows[0];
      const looksLikeData = probe.length >= 2 && probe[0] && probe[1] &&
        !/^\d+$/.test(probe[0]) && !/^spotify:/.test(probe[0]);

      if (looksLikeData) {
        // Attempt headerless tandabase format
        return parseTandabaseCsv(rows, 0);
      }

      throw new Error(
        'Unrecognised CSV format.\n\n' +
        'Supported formats:\n' +
        '• Tandabase: orchestra, title, year, singer, genre\n' +
        '• Exportify: Track URI, Track Name, Album Name, Artist Name(s), ...\n\n' +
        'Make sure your CSV has column headers or follows the orchestra, title, year, singer, genre structure.',
      );
    }
  }
}
