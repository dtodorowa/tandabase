/**
 * Parse an Apple Music / iTunes XML (plist) export into typed track + playlist data.
 * Works entirely client-side using DOMParser.
 */

export interface PlistTrack {
  trackId: number;
  name: string;
  artist: string;
  composer: string;
  album: string;
  genre: string;
  year: number | null;
  comments: string;
  totalTime: number | null; // milliseconds
  bpm: number | null;
}

export interface PlistPlaylist {
  name: string;
  description: string;
  trackIds: number[];
}

export interface PlistLibrary {
  tracks: Map<number, PlistTrack>;
  playlists: PlistPlaylist[];
}

/**
 * Parse a plist <dict> node into a key→value Map.
 * Handles <string>, <integer>, <date>, <true/>, <false/>, <array>, nested <dict>.
 */
function parseDictNode(dictNode: Element): Map<string, any> {
  const result = new Map<string, any>();
  const children = Array.from(dictNode.children);

  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (child.tagName !== 'key') continue;

    const key = child.textContent ?? '';
    const valueNode = children[i + 1];
    if (!valueNode) break;

    result.set(key, parsePlistValue(valueNode));
    i++; // skip value node
  }
  return result;
}

function parsePlistValue(node: Element): any {
  switch (node.tagName) {
    case 'string':
      return node.textContent ?? '';
    case 'integer':
      return parseInt(node.textContent ?? '0', 10);
    case 'real':
      return parseFloat(node.textContent ?? '0');
    case 'true':
      return true;
    case 'false':
      return false;
    case 'date':
      return node.textContent ?? '';
    case 'dict':
      return parseDictNode(node);
    case 'array':
      return Array.from(node.children).map(parsePlistValue);
    case 'data':
      return node.textContent ?? '';
    default:
      return null;
  }
}

function trackFromDict(dict: Map<string, any>): PlistTrack {
  return {
    trackId: dict.get('Track ID') ?? 0,
    name: dict.get('Name') ?? '',
    artist: dict.get('Artist') ?? '',
    composer: dict.get('Composer') ?? '',
    album: dict.get('Album') ?? '',
    genre: dict.get('Genre') ?? '',
    year: dict.has('Year') ? dict.get('Year') : null,
    comments: dict.get('Comments') ?? '',
    totalTime: dict.has('Total Time') ? dict.get('Total Time') : null,
    bpm: dict.has('BPM') ? dict.get('BPM') : null,
  };
}

/**
 * Parse an Apple Music XML plist string into a PlistLibrary.
 */
export function parsePlistXml(xmlString: string): PlistLibrary {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'text/xml');

  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error('Invalid XML: ' + parseError.textContent);
  }

  // Root <plist><dict>
  const rootDict = doc.querySelector('plist > dict');
  if (!rootDict) {
    throw new Error('No root dict found in plist');
  }

  const root = parseDictNode(rootDict);

  // Parse Tracks dict
  const tracksDict: Map<string, any> = root.get('Tracks');
  const tracks = new Map<number, PlistTrack>();

  if (tracksDict instanceof Map) {
    for (const [, value] of tracksDict) {
      if (value instanceof Map) {
        const track = trackFromDict(value);
        if (track.trackId) {
          tracks.set(track.trackId, track);
        }
      }
    }
  }

  // Parse Playlists array
  const playlistsArray: any[] = root.get('Playlists') ?? [];
  const playlists: PlistPlaylist[] = [];

  for (const pl of playlistsArray) {
    if (!(pl instanceof Map)) continue;
    const name = pl.get('Name') ?? '';
    const desc = pl.get('Description') ?? '';
    const items: any[] = pl.get('Playlist Items') ?? [];

    const trackIds: number[] = items
      .filter((item: any) => item instanceof Map)
      .map((item: Map<string, any>) => item.get('Track ID') as number)
      .filter((id: number) => id != null);

    playlists.push({ name, description: desc, trackIds });
  }

  return { tracks, playlists };
}
