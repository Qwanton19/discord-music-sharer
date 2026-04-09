import YTMusic from 'ytmusic-api';
import { Song } from '../types';

let ytMusic: YTMusic | null = null;
let initPromise: Promise<void> | null = null;
let isInitialized = false;

async function initializeClient(): Promise<void> {
  if (isInitialized) return;
  
  if (!initPromise) {
    initPromise = (async () => {
      try {
        console.log('Initializing YouTube Music client...');
        ytMusic = new YTMusic();
        await ytMusic.initialize();
        isInitialized = true;
        console.log('YouTube Music client initialized successfully');
      } catch (error) {
        console.error('Failed to initialize YouTube Music client:', error);
        ytMusic = null;
        isInitialized = false;
      }
    })();
  }
  
  await initPromise;
}

initializeClient();

async function getClient(): Promise<YTMusic | null> {
  if (!isInitialized) await initializeClient();
  return ytMusic;
}

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function titleMatches(title1: string, title2: string): boolean {
  const t1 = normalizeText(title1);
  const t2 = normalizeText(title2);
  return t1 === t2 || t1.includes(t2) || t2.includes(t1);
}

function parseArtist(track: any): string {
  if (track.artist) {
    if (typeof track.artist === 'string') return track.artist;
    if (track.artist.name) return track.artist.name;
    if (Array.isArray(track.artist)) {
      return track.artist.map((a: any) => a.name || a).join(', ');
    }
  }
  
  if (track.artists) {
    if (typeof track.artists === 'string') return track.artists;
    if (Array.isArray(track.artists)) {
      return track.artists.map((a: any) => {
        if (typeof a === 'string') return a;
        if (a?.name) return a.name;
        return String(a);
      }).join(', ');
    }
  }
  
  const title = track.name || track.title || '';
  if (title.includes(' - ')) {
    const parts = title.split(' - ');
    if (parts.length >= 2) return parts[1].trim();
  }
  
  return 'Unknown Artist';
}

function artistContains(trackArtist: string, searchArtist: string): boolean {
  const a1 = normalizeText(trackArtist);
  const a2 = normalizeText(searchArtist);
  if (!a1 || !a2) return false;
  return a1 === a2 || a1.includes(a2) || a2.includes(a1);
}

export async function searchYouTubeMusic(query: string, songTitle?: string, artistName?: string, limit: number = 10): Promise<Song[]> {
  try {
    const client = await getClient();
    if (!client) return [];

    const searchPromise = client.search(query);
    const timeoutPromise = new Promise<null>((_, reject) => 
      setTimeout(() => reject(new Error('YouTube Music search timeout')), 5000)
    );

    const results = await Promise.race([searchPromise, timeoutPromise]) as any[];

    if (!results || !Array.isArray(results)) {
      console.log(`YouTube Music: No results returned`);
      return [];
    }

    console.log(`YouTube Music: search() returned ${results.length} results`);

    const songs = results.filter((result: any) => {
      const isSong = result.type === 'song' || result.wrapperType === 'track' || result.videoId;
      return isSong;
    });
    
    const mappedSongs = songs.map((track: any): Song => {
      const title = track.name || track.title || 'Unknown Title';
      const artist = parseArtist(track);
      const videoId = track.videoId || track.id;
      
      let url = track.url;
      if (!url && videoId) {
        url = `https://music.youtube.com/watch?v=${videoId}`;
      } else if (url && !url.startsWith('http')) {
        url = `https://music.youtube.com${url}`;
      }

      return {
        title,
        artist,
        album: track.album?.name || track.album,
        albumArt: track.thumbnails?.[0]?.url || track.thumbnail,
        youtubeMusicUrl: url
      };
    });
    
    const filtered = mappedSongs.filter(song => {
      const titleMatch = !songTitle || titleMatches(song.title, songTitle);
      const artistMatch = !artistName || artistContains(song.artist, artistName);
      return titleMatch && artistMatch;
    });
    
    console.log(`YouTube Music found ${filtered.length} songs for "${query}"`);

    return filtered.slice(0, limit);
  } catch (error) {
    console.error('YouTube Music search error:', error);
    return [];
  }
}
