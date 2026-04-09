export type MusicService = 'spotify' | 'youtube' | 'apple' | 'all';

export interface Song {
  title: string;
  artist: string;
  album?: string;
  albumArt?: string;
  isrc?: string;
  spotifyUrl?: string;
  youtubeMusicUrl?: string;
  appleMusicUrl?: string;
}
