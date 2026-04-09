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

export async function searchAppleMusic(songTitle: string, artistName: string, limit: number = 50): Promise<Song[]> {
  try {
    console.log(`Apple Music: Searching for "${songTitle}" by "${artistName}"`);
    
    const directResults = await searchDirect(songTitle, artistName, limit);
    if (directResults.length > 0) {
      console.log(`Apple Music: Found ${directResults.length} via direct search`);
      return directResults;
    }

    const artistId = await findArtistId(artistName);
    if (!artistId) {
      console.log(`Apple Music: Artist "${artistName}" not found`);
      return [];
    }
    console.log(`Apple Music: Found artist ID ${artistId}`);

    const albumIds = await findAlbumIds(songTitle, artistName, artistId, limit);
    console.log(`Apple Music: Found ${albumIds.length} potential albums`);
    
    const allTracks: Song[] = [];
    
    for (const albumId of albumIds.slice(0, 5)) {
      const tracks = await getAlbumTracks(albumId, songTitle, artistName);
      allTracks.push(...tracks);
    }
    
    console.log(`Apple Music: Found ${allTracks.length} matching tracks via album search`);
    
    return allTracks;
  } catch (error) {
    console.error('Apple Music search error:', error);
    return [];
  }
}

async function searchDirect(songTitle: string, artistName: string, limit: number): Promise<Song[]> {
  const query = `${songTitle} ${artistName}`;
  const response = await fetch(
    `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=${limit}`
  );

  if (response.status === 429) {
    console.log(`Apple Music: Rate limited (429) - too many requests`);
    return [];
  }

  if (!response.ok) {
    console.log(`Apple Music: Direct search failed with status ${response.status}`);
    return [];
  }

  const data = await response.json() as ITunesSearchResponse;
  
  if (!data.results || data.results.length === 0) {
    console.log(`Apple Music: Direct search returned no results`);
    return [];
  }

  console.log(`Apple Music: Direct search returned ${data.results.length} results`);

  return data.results
    .filter((track: ITunesTrack) => track.wrapperType === 'track')
    .filter((track: ITunesTrack) => titleMatches(track.trackName, songTitle))
    .map((track: ITunesTrack): Song => ({
      title: track.trackName,
      artist: track.artistName,
      album: track.collectionName,
      albumArt: track.artworkUrl100,
      isrc: track.isrc,
      appleMusicUrl: track.trackViewUrl.replace('&uo=4', '')
    }));
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

async function findAlbumIds(songTitle: string, artistName: string, artistId: number, limit: number): Promise<number[]> {
  const albumIds: number[] = [];

  const directAlbumSearch = await fetch(
    `https://itunes.apple.com/search?term=${encodeURIComponent(songTitle + ' ' + artistName)}&media=music&entity=album&limit=${limit}`
  );

  if (directAlbumSearch.status === 429) {
    console.log(`Apple Music: Rate limited (429) on album search`);
    return albumIds;
  }

  if (directAlbumSearch.ok) {
    const data = await directAlbumSearch.json() as ITunesSearchResponse;
    if (data.results && data.results.length > 0) {
      console.log(`Apple Music: Album search found ${data.results.length} albums`);
      for (const album of data.results) {
        if (album.collectionId && !albumIds.includes(album.collectionId)) {
          albumIds.push(album.collectionId);
        }
      }
    } else {
      console.log(`Apple Music: Album search returned no results`);
    }
  }

  const artistAlbums = await fetch(
    `https://itunes.apple.com/lookup?id=${artistId}&entity=album&limit=${limit}`
  );

  if (artistAlbums.status === 429) {
    console.log(`Apple Music: Rate limited (429) on artist albums lookup`);
    return albumIds;
  }

  if (artistAlbums.ok) {
    const data = await artistAlbums.json() as ITunesSearchResponse;
    if (data.results) {
      const normalizedTitle = normalizeText(songTitle);
      for (const album of data.results) {
        if (album.wrapperType === 'collection' && album.collectionId) {
          const normalizedAlbum = normalizeText(album.collectionName || '');
          if (normalizedAlbum.includes(normalizedTitle) || normalizedTitle.includes(normalizedAlbum)) {
            if (!albumIds.includes(album.collectionId)) {
              albumIds.push(album.collectionId);
            }
          }
        }
      }
    }
  }

  return albumIds;
}

async function getAlbumTracks(albumId: number, songTitle: string, artistName: string): Promise<Song[]> {
  const response = await fetch(
    `https://itunes.apple.com/lookup?id=${albumId}&entity=song&limit=50`
  );

  if (response.status === 429) {
    console.log(`Apple Music: Rate limited (429) on album tracks lookup`);
    return [];
  }

  if (!response.ok) {
    console.log(`Apple Music: Album lookup ${albumId} failed with status ${response.status}`);
    return [];
  }

  const data = await response.json() as ITunesSearchResponse;
  
  if (!data.results) {
    console.log(`Apple Music: Album lookup ${albumId} returned no results`);
    return [];
  }

  return data.results
    .filter((track: ITunesTrack) => track.wrapperType === 'track')
    .filter((track: ITunesTrack) => titleMatches(track.trackName, songTitle))
    .map((track: ITunesTrack): Song => ({
      title: track.trackName,
      artist: track.artistName,
      album: track.collectionName,
      albumArt: track.artworkUrl100,
      isrc: track.isrc,
      appleMusicUrl: track.trackViewUrl.replace('&uo=4', '')
    }));
}
