import { Song } from '../types';

interface ITunesSearchResponse {
  resultCount: number;
  results: any[];
}

interface ITunesArtist {
  artistId: number;
  artistName: string;
}

interface ITunesTrack {
  trackName: string;
  artistName: string;
  collectionName: string;
  artworkUrl100: string;
  trackViewUrl: string;
  isrc?: string;
  wrapperType: string;
}

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function titleMatches(title1: string, title2: string): boolean {
  const t1 = normalizeText(title1);
  const t2 = normalizeText(title2);
  return t1 === t2 || t1.includes(t2) || t2.includes(t1);
}

function artistContains(trackArtist: string, searchArtist: string): boolean {
  const a1 = normalizeText(trackArtist);
  const a2 = normalizeText(searchArtist);
  if (!a1 || !a2) return false;
  return a1 === a2 || a1.includes(a2) || a2.includes(a1);
}

export async function searchAppleMusic(songTitle: string, artistName: string, limit: number = 100): Promise<Song[]> {
  try {
    console.log(`Apple Music: Searching for "${songTitle}" by "${artistName}"`);
    
    const artistId = await findArtistId(artistName);
    if (!artistId) {
      console.log(`Apple Music: Artist "${artistName}" not found`);
      return [];
    }
    console.log(`Apple Music: Found artist ID ${artistId}`);

    const songs = await getSongsByArtist(artistId, limit);
    console.log(`Apple Music: Artist has ${songs.length} songs`);
    
    let filteredCount = 0;
    const filtered = songs.filter(song => {
      const titleMatch = titleMatches(song.title, songTitle);
      const artistMatch = artistContains(song.artist, artistName);
      if (!titleMatch && artistMatch) {
        filteredCount++;
      }
      return titleMatch && artistMatch;
    });
    
    if (filteredCount > 0) {
      console.log(`Apple Music: Filtered out ${filteredCount} songs that didn't match title`);
    }
    console.log(`Apple Music: Found ${filtered.length} matching songs`);
    
    return filtered;
  } catch (error) {
    console.error('Apple Music search error:', error);
    return [];
  }
}

async function findArtistId(artistName: string): Promise<number | null> {
  const response = await fetch(
    `https://itunes.apple.com/search?term=${encodeURIComponent(artistName)}&media=music&entity=musicArtist&limit=5`
  );

  if (response.status === 429) {
    console.log(`Apple Music: Rate limited (429) on artist search`);
    return null;
  }

  if (!response.ok) {
    console.log(`Apple Music: Artist search failed with status ${response.status}`);
    return null;
  }

  const data = await response.json() as ITunesSearchResponse;
  
  if (!data.results || data.results.length === 0) {
    console.log(`Apple Music: Artist search returned no results`);
    return null;
  }

  const normalizedArtist = normalizeText(artistName);
  const matchingArtist = data.results.find((artist: ITunesArtist) => {
    const normalized = normalizeText(artist.artistName);
    return normalized === normalizedArtist || normalized.includes(normalizedArtist) || normalizedArtist.includes(normalized);
  });

  return matchingArtist?.artistId || null;
}

async function getSongsByArtist(artistId: number, limit: number): Promise<Song[]> {
  const response = await fetch(
    `https://itunes.apple.com/lookup?id=${artistId}&entity=song&limit=${limit}`
  );

  if (response.status === 429) {
    console.log(`Apple Music: Rate limited (429) on artist songs lookup`);
    return [];
  }

  if (!response.ok) {
    console.log(`Apple Music: Artist songs lookup failed with status ${response.status}`);
    return [];
  }

  const data = await response.json() as ITunesSearchResponse;
  
  if (!data.results || data.results.length === 0) {
    return [];
  }

  return data.results
    .filter((track: ITunesTrack) => track.wrapperType === 'track')
    .map((track: ITunesTrack): Song => ({
      title: track.trackName,
      artist: track.artistName,
      album: track.collectionName,
      albumArt: track.artworkUrl100,
      isrc: track.isrc,
      appleMusicUrl: track.trackViewUrl.replace('&uo=4', '')
    }));
}
