/**
 * Match imported songs against local discography JSON files.
 *
 * Strategy:
 * 1. Determine which orchestra the tanda belongs to
 * 2. Load that orchestra's discography
 * 3. For each song, fuzzy-match by title (+ optional singer/year)
 * 4. If matched, pull the youtube_id from the discography
 */

import { ORCHESTRAS, loadDiscography, type Recording } from './discography';
import type { ImportedTanda, ImportedSong } from './playlist-import';
import type { Genre } from '$lib/types';

export interface MatchResult {
  song: ImportedSong;
  matched: boolean;
  recording: Recording | null;
  confidence: 'exact' | 'high' | 'low' | 'none';
}

export interface TandaMatchResult {
  tanda: ImportedTanda;
  orchestraKey: string | null;
  results: MatchResult[];
  matchedCount: number;
  totalCount: number;
}

/**
 * Normalise a string for fuzzy comparison:
 * lowercase, strip accents, remove punctuation, collapse whitespace
 */
function normalise(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // strip accents
    .replace(/[^\w\s]/g, '')           // strip punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Find the best orchestra key for a given orchestra name from the import.
 * e.g. "Carlos Di Sarli" → "Di Sarli", "Sexteto Carlos Di Sarli" → "Di Sarli"
 */
function findOrchestraKey(orchestra: string): string | null {
  const norm = normalise(orchestra);

  // Direct match first
  for (const key of Object.keys(ORCHESTRAS)) {
    if (normalise(key) === norm) return key;
  }

  // Check if the orchestra name contains the key
  for (const key of Object.keys(ORCHESTRAS)) {
    if (norm.includes(normalise(key))) return key;
  }

  // Check if the key is contained in the orchestra name
  for (const key of Object.keys(ORCHESTRAS)) {
    if (normalise(key).includes(norm) && norm.length > 2) return key;
  }

  return null;
}

/**
 * Score how well an imported song matches a discography recording.
 * Returns 0-100.
 */
function matchScore(song: ImportedSong, rec: Recording): number {
  let score = 0;

  const songTitle = normalise(song.title);
  const recTitle = normalise(rec.title);

  // Title match is the most important signal
  if (songTitle === recTitle) {
    score += 60;
  } else if (songTitle.includes(recTitle) || recTitle.includes(songTitle)) {
    score += 40;
  } else {
    // Check word overlap
    const songWords = new Set(songTitle.split(' ').filter(w => w.length > 2));
    const recWords = new Set(recTitle.split(' ').filter(w => w.length > 2));
    const overlap = [...songWords].filter(w => recWords.has(w)).length;
    const total = Math.max(songWords.size, recWords.size);
    if (total > 0) {
      score += Math.round((overlap / total) * 30);
    }
  }

  // Year match
  if (song.year && rec.recording_date) {
    const recYear = parseInt(rec.recording_date.slice(0, 4), 10);
    if (song.year === recYear) {
      score += 20;
    } else if (Math.abs(song.year - recYear) <= 1) {
      score += 10;
    }
  }

  // Singer match
  if (song.singer && rec.singer) {
    const songSinger = normalise(song.singer);
    const recSinger = normalise(rec.singer);
    if (songSinger === recSinger) {
      score += 20;
    } else if (songSinger.includes(recSinger) || recSinger.includes(songSinger)) {
      score += 10;
    }
  } else if (!song.singer && (rec.singer === 'Instrumental' || rec.singer === '-' || !rec.singer)) {
    // Both instrumental — small bonus
    score += 10;
  }

  return score;
}

/**
 * Match a single song against a discography.
 * Returns the best match if the score is high enough.
 */
function matchSong(song: ImportedSong, recordings: Recording[]): MatchResult {
  let bestScore = 0;
  let bestRec: Recording | null = null;

  for (const rec of recordings) {
    const score = matchScore(song, rec);
    if (score > bestScore) {
      bestScore = score;
      bestRec = rec;
    }
  }

  let confidence: MatchResult['confidence'] = 'none';
  if (bestScore >= 70) confidence = 'exact';
  else if (bestScore >= 50) confidence = 'high';
  else if (bestScore >= 30) confidence = 'low';

  return {
    song,
    matched: bestScore >= 50,
    recording: bestScore >= 30 ? bestRec : null,
    confidence,
  };
}

/**
 * Match all tandas from an import against the local discographies.
 */
export async function matchImportAgainstDiscography(
  tandas: ImportedTanda[]
): Promise<TandaMatchResult[]> {
  const results: TandaMatchResult[] = [];

  for (const tanda of tandas) {
    const orchestraKey = findOrchestraKey(tanda.orchestra);

    if (!orchestraKey) {
      // Orchestra not in our discography — mark all as unmatched
      results.push({
        tanda,
        orchestraKey: null,
        results: tanda.songs.map(song => ({
          song,
          matched: false,
          recording: null,
          confidence: 'none' as const,
        })),
        matchedCount: 0,
        totalCount: tanda.songs.length,
      });
      continue;
    }

    try {
      const recordings = await loadDiscography(orchestraKey);
      const songResults = tanda.songs.map(song => matchSong(song, recordings));

      results.push({
        tanda,
        orchestraKey,
        results: songResults,
        matchedCount: songResults.filter(r => r.matched).length,
        totalCount: tanda.songs.length,
      });
    } catch {
      results.push({
        tanda,
        orchestraKey,
        results: tanda.songs.map(song => ({
          song,
          matched: false,
          recording: null,
          confidence: 'none' as const,
        })),
        matchedCount: 0,
        totalCount: tanda.songs.length,
      });
    }
  }

  return results;
}
