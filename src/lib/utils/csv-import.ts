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

export function parseCsvToTandas(csvText: string): CsvImportResult {
  const rows = parseRows(csvText);
  if (rows.length === 0) throw new Error('CSV is empty');

  // Detect header row
  let startIndex = 0;
  const firstRow = rows[0].map(c => c.toLowerCase());
  if (firstRow.includes('orchestra') || firstRow.includes('title') || firstRow.includes('song')) {
    startIndex = 1;
  }

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
