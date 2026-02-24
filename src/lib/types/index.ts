export type Genre = 'Tango' | 'Milonga' | 'Vals';
export type Visibility = 'private' | 'public';

export interface Song {
  id: string;
  title: string;
  singer: string | null;
  year: number | null;
  video_id: string;
  video_title: string;
  thumbnail: string;
}

export interface Tanda {
  id: string;
  num: number;
  orchestra: string;
  genre: Genre;
  songs: Song[];
}

export interface PracticaSet {
  id?: string;
  title: string;
  description: string;
  cover_image?: string;
  authorId: string;
  authorName: string;
  visibility: Visibility;
  genre_summary: Genre[];
  tanda_count: number;
  song_count: number;
  created_at: Date;
  updated_at: Date;
  tandas: Tanda[];
}

export interface UserProfile {
  displayName: string;
  photoURL: string | null;
  createdAt: Date;
}

export interface YouTubeSearchResult {
  video_id: string;
  title: string;
  channel: string;
  thumbnail: string;
  published_at: string;
}

export interface VideoFlag {
  id?: string;
  setId: string;
  setTitle: string;
  ownerId: string;
  tandaIndex: number;
  songIndex: number;
  songTitle: string;
  currentVideoId: string;
  reason: string;
  flaggedBy: string;
  flaggedByName: string;
  created_at: Date;
  resolved: boolean;
}

export interface Comment {
  id?: string;
  setId: string;
  tandaIndex: number;
  authorId: string;
  authorName: string;
  authorPhoto: string | null;
  text: string;
  created_at: Date;
}
