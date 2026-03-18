export interface Recording {
  title: string;
  artist: string;
  recording_date: string;
  composer: string;
  author: string;
  lyrics: string;
  lyrics_credit: string;
  duration: string;
  genre: string;
  rating: number;
  orchestra: string;
  singer: string;
  youtube_id?: string;
}

// Known orchestras mapped to their JSON filenames
export const ORCHESTRAS: Record<string, string> = {
  "Biagi": "Biagi_discography.json",
  "Brunswick": "Brunswick_discography.json",
  "Caló": "Calo_discography.json",
  "Canaro": "Canaro_discography.json",
  "D'Agostino": "Dagostino_discography.json",
  "D'Arienzo": "Darienzo_discography.json",
  "De Angelis": "DeAngelis_discography.json",
  "De Caro": "DeCaro_discography.json",
  "Demare": "Demare_discography.json",
  "Di Sarli": "DiSarli_discography.json",
  "Donato": "Donato_discography.json",
  "Firpo": "Firpo_discography.json",
  "Fresedo": "Fresedo_discography.json",
  "Laurenz": "Laurenz_discography.json",
  "Lomuto": "Lomuto_discography.json",
  "Pirincho": "Pirincho_discography.json",
  "Pugliese": "Pugliese_discography.json",
  "Rodríguez": "Rodriguez_discography.json",
  "Tanturi": "Tanturi_discography.json",
  "Troilo": "Troilo_discography.json",
  "Víctor": "Victor_discography.json",
};

export const ORCHESTRA_NAMES = Object.keys(ORCHESTRAS).sort();

// Cache loaded discographies in memory
const cache = new Map<string, Recording[]>();

export async function loadDiscography(orchestraKey: string): Promise<Recording[]> {
  if (cache.has(orchestraKey)) {
    return cache.get(orchestraKey)!;
  }

  const filename = ORCHESTRAS[orchestraKey];
  if (!filename) {
    throw new Error(`Unknown orchestra: ${orchestraKey}`);
  }

  const resp = await fetch(`/discographies/${filename}`);
  if (!resp.ok) {
    throw new Error(`Failed to load discography for ${orchestraKey}`);
  }

  const data: Recording[] = await resp.json();
  cache.set(orchestraKey, data);
  return data;
}

// Extract unique singers from a discography
export function getSingers(recordings: Recording[]): string[] {
  const singers = new Set<string>();
  for (const r of recordings) {
    if (r.singer && r.singer !== 'Instrumental' && r.singer !== '-') {
      singers.add(r.singer);
    }
  }
  return [...singers].sort();
}

// Extract unique years from a discography
export function getYears(recordings: Recording[]): string[] {
  const years = new Set<string>();
  for (const r of recordings) {
    if (r.recording_date) {
      years.add(r.recording_date);
    }
  }
  return [...years].sort();
}

// Extract unique genres from a discography
export function getGenres(recordings: Recording[]): string[] {
  const genres = new Set<string>();
  for (const r of recordings) {
    if (r.genre) {
      genres.add(r.genre);
    }
  }
  return [...genres].sort();
}

// Search/filter recordings with fuzzy matching
export function searchRecordings(
  recordings: Recording[],
  query: string,
  filters?: { genre?: string; singer?: string; year?: string },
  maxResults = 100,
): Recording[] {
  let filtered = recordings;

  if (filters?.genre) {
    filtered = filtered.filter(r => r.genre === filters.genre);
  }
  if (filters?.singer) {
    filtered = filtered.filter(r => r.singer === filters.singer);
  }
  if (filters?.year) {
    filtered = filtered.filter(r => r.recording_date === filters.year);
  }

  if (!query.trim()) {
    return filtered.slice(0, maxResults);
  }

  const q = query.toLowerCase().trim();
  const terms = q.split(/\s+/);

  return filtered
    .filter(r => {
      const haystack = `${r.title} ${r.singer} ${r.composer} ${r.recording_date}`.toLowerCase();
      return terms.every(term => haystack.includes(term));
    })
    .sort((a, b) => {
      // Prioritize title matches, then higher ratings
      const aTitle = a.title.toLowerCase().includes(q) ? 1 : 0;
      const bTitle = b.title.toLowerCase().includes(q) ? 1 : 0;
      if (bTitle !== aTitle) return bTitle - aTitle;
      return (b.rating ?? 0) - (a.rating ?? 0);
    })
    .slice(0, maxResults);
}
