import { Song, MusicService } from './types';
import { searchSpotify } from './services/spotify';
import { searchYouTubeMusic } from './services/youtube';
import { searchAppleMusic } from './services/apple';
import Fuse from 'fuse.js';

interface CachedSearch {
  songs: Song[];
  timestamp: number;
}

const searchCache = new Map<string, CachedSearch>();
const CACHE_TTL = 5 * 60 * 1000;

function normalizeQuery(song: string, artist?: string): string {
  const parts = [song];
  if (artist) parts.push(artist);
  return parts.join(' ').toLowerCase().trim();
}

function getSongsFromCache(key: string): Song[] | null {
  const cached = searchCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.songs;
  }
  searchCache.delete(key);
  return null;
}

function cacheSongs(key: string, songs: Song[]): void {
  searchCache.set(key, { songs, timestamp: Date.now() });
}

export async function searchSong(
  songTitle: string,
  artistName?: string,
  service: MusicService = 'all'
): Promise<Song[]> {
  const query = normalizeQuery(songTitle, artistName);
  const cacheKey = `${query}:all`;
  
  const cached = getSongsFromCache(cacheKey);
  if (cached) {
    console.log(`Returning cached results for "${query}"`);
    return cached;
  }

  console.log(`Searching for "${query}"...`);

  const [spotifyResults, ytResults, appleResults] = await Promise.all([
    searchSpotify(artistName ? `${songTitle} artist:${artistName}` : songTitle).catch(e => {
      console.error('Spotify search error:', e);
      return [];
    }),
    searchYouTubeMusic(artistName ? `${songTitle} ${artistName}` : songTitle).catch(e => {
      console.error('YouTube Music search error:', e);
      return [];
    }),
    searchAppleMusic(songTitle, artistName || '').catch(e => {
      console.error('Apple Music search error:', e);
      return [];
    })
  ]);

  console.log(`Results: Spotify=${spotifyResults.length}, YouTube=${ytResults.length}, Apple=${appleResults.length}`);
  console.log('Spotify top results:', spotifyResults.slice(0, 3).map(s => `"${s.title}" by ${s.artist}`));
  console.log('YouTube top results:', ytResults.slice(0, 3).map(s => `"${s.title}" by ${s.artist}`));
  console.log('Apple top results:', appleResults.slice(0, 3).map(s => `"${s.title}" by ${s.artist}`));

  let songs = [...spotifyResults, ...ytResults, ...appleResults];
  
  console.log(`Total songs before merge: ${songs.length}`);

  const mergedSongs = mergeAndDeduplicate(songs);
  
  console.log(`Songs after merge: ${mergedSongs.length}`);
  console.log('Top merged results:', mergedSongs.slice(0, 3).map(s => 
    `"${s.title}" by ${s.artist} [Spotify: ${!!s.spotifyUrl}, YT: ${!!s.youtubeMusicUrl}, Apple: ${!!s.appleMusicUrl}]`
  ));
  
  const scoredResults = scoreResults(mergedSongs, songTitle, artistName);
  
  cacheSongs(cacheKey, scoredResults);
  
  return scoredResults;
}

function normalizeForMerge(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function artistsMatch(artist1: string, artist2: string): boolean {
  const a1 = normalizeForMerge(artist1);
  const a2 = normalizeForMerge(artist2);
  
  if (a1 === a2) return true;
  
  if (a1.includes(a2) || a2.includes(a1)) return true;
  
  const variations: Record<string, string[]> = {
    'rachel platten': ['rachel prancer'],
    'rachel prancer': ['rachel platten'],
  };
  
  for (const [canonical, alts] of Object.entries(variations)) {
    if ((a1 === canonical || alts.some(alt => a1 === alt)) &&
        (a2 === canonical || alts.some(alt => a2 === alt))) {
      return true;
    }
  }
  
  return false;
}

function mergeAndDeduplicate(songs: Song[]): Song[] {
  const mergedSongs: Song[] = [];
  
  for (const song of songs) {
    const normalizedTitle = normalizeForMerge(song.title);
    const normalizedArtist = normalizeForMerge(song.artist);
    const isUnknownArtist = normalizedArtist === 'unknown artist';
    const hasCleanTitle = !song.title.toLowerCase().includes(' by ') && !song.title.toLowerCase().includes('(');
    
    let foundMatch = false;
    
    if (song.isrc) {
      const existing = mergedSongs.find(s => s.isrc === song.isrc);
      if (existing) {
        mergeSongUrls(existing, song);
        foundMatch = true;
      }
    }
    
    if (!foundMatch) {
      for (const existing of mergedSongs) {
        const existingTitle = normalizeForMerge(existing.title);
        const existingArtist = normalizeForMerge(existing.artist);
        const existingIsUnknown = existingArtist === 'unknown artist';
        const existingHasCleanTitle = !existing.title.toLowerCase().includes(' by ') && !existing.title.toLowerCase().includes('(');
        
        const exactTitleMatch = normalizedTitle === existingTitle;
        const partialTitleMatch = normalizedTitle.includes(existingTitle) || existingTitle.includes(normalizedTitle);
        
        if (!exactTitleMatch && !partialTitleMatch) continue;
        
        if (exactTitleMatch && !existingIsUnknown && !isUnknownArtist) {
          if (artistsMatch(song.artist, existing.artist)) {
            console.log(`Merging exact title+artist match: "${song.title}" by ${song.artist} with "${existing.title}" by ${existing.artist}`);
            mergeSongUrls(existing, song);
            if (hasCleanTitle && !existingHasCleanTitle) {
              existing.youtubeMusicUrl = song.youtubeMusicUrl;
            }
            foundMatch = true;
            break;
          }
        }
        
        if (isUnknownArtist || existingIsUnknown) {
          if (exactTitleMatch) {
            console.log(`Merging exact title match with unknown artist: "${song.title}" (${song.artist}) with "${existing.title}" (${existing.artist})`);
            mergeSongUrls(existing, song);
            foundMatch = true;
            break;
          }
        }
        
        if (partialTitleMatch && !exactTitleMatch) {
          if (artistsMatch(song.artist, existing.artist)) {
            console.log(`Merging partial title+artist match: "${song.title}" by ${song.artist} ~= ${existing.artist}`);
            if (hasCleanTitle && !existingHasCleanTitle) {
              existing.youtubeMusicUrl = song.youtubeMusicUrl;
            }
            foundMatch = true;
            break;
          }
        }
      }
    }
    
    if (!foundMatch) {
      mergedSongs.push({ ...song });
    }
  }
  
  return mergedSongs;
}

function mergeSongUrls(target: Song, source: Song): void {
  if (source.spotifyUrl) target.spotifyUrl = source.spotifyUrl;
  if (source.appleMusicUrl) target.appleMusicUrl = source.appleMusicUrl;
  if (source.youtubeMusicUrl) target.youtubeMusicUrl = source.youtubeMusicUrl;
  if (source.albumArt && !target.albumArt) target.albumArt = source.albumArt;
  if (source.album && !target.album) target.album = source.album;
  if (source.isrc && !target.isrc) target.isrc = source.isrc;
  if (target.artist === 'Unknown Artist' && source.artist !== 'Unknown Artist') {
    target.artist = source.artist;
  }
}

function scoreResults(songs: Song[], songTitle: string, artistName?: string): Song[] {
  if (songs.length === 0) return [];

  const fuse = new Fuse(songs, {
    keys: [
      { name: 'title', weight: 0.6 },
      { name: 'artist', weight: 0.4 }
    ],
    threshold: 0.4,
    includeScore: true
  });

  const searchTerm = artistName ? `${songTitle} ${artistName}` : songTitle;
  const results = fuse.search(searchTerm);
  
  return results
    .map(r => r.item)
    .concat(songs.filter(s => !results.find(r => r.item === s)));
}
