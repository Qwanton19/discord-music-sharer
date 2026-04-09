import { Song, MusicService } from './types';

const DEFAULT_COLOR = 0x5865F2;

export function buildSongEmbed(song: Song, username: string): { embeds: any[]; components: any[] } {
  const embed: any = {
    title: song.title,
    description: `by **${song.artist}**${song.album ? `\nfrom *${song.album}*` : ''}`,
    color: DEFAULT_COLOR,
    fields: []
  };

  if (song.albumArt) {
    embed.thumbnail = { url: song.albumArt };
  }

  embed.fields.push({
    name: '\u200B',
    value: `🎵 [Shared](https://discord.com/oauth2/authorize?client_id=1491727102956015656) by **${username}**`,
    inline: false
  });

  const buttons: any[] = [];

  if (song.spotifyUrl) {
    buttons.push({
      type: 2,
      style: 5,
      label: 'Spotify',
      url: song.spotifyUrl,
      emoji: { name: '🎵' }
    });
  }

  if (song.youtubeMusicUrl) {
    buttons.push({
      type: 2,
      style: 5,
      label: 'YouTube Music',
      url: song.youtubeMusicUrl,
      emoji: { name: '📺' }
    });
  }

  if (song.appleMusicUrl) {
    buttons.push({
      type: 2,
      style: 5,
      label: 'Apple Music',
      url: song.appleMusicUrl,
      emoji: { name: '🍎' }
    });
  }

  const components = buttons.length > 0
    ? [{ type: 1, components: buttons.slice(0, 5) }]
    : [];

  return { embeds: [embed], components };
}

export function buildSelectionMessage(
  songs: Song[],
  username: string,
  channelId: string,
  originalToken: string
): any {
  const songList = songs.slice(0, 3)
    .map((song, i) => `${i + 1}. **${song.title}** by **${song.artist}**${song.album ? ` (_${song.album}_)` : ''}`)
    .join('\n');

  const buttons = songs.slice(0, 3).map((song, i) => ({
    type: 2,
    style: 2,
    label: `${i + 1}. ${song.title.length > 20 ? song.title.substring(0, 20) + '...' : song.title}`,
    custom_id: `select_${i}_${encodeURIComponent(song.title)}_${encodeURIComponent(song.artist)}_${channelId}_${originalToken}`
  }));

  return {
    content: `🔍 Found multiple songs matching your search!\n\n${songList}\n\nClick a button to share:`,
    embeds: [],
    flags: 64,
    components: [{ type: 1, components: buttons }]
  };
}

export function buildNoResultsMessage(query: string): any {
  return {
    content: `❌ No songs found for "${query}". Try adjusting your search terms.`
  };
}

export function buildServiceUnavailableMessage(song: Song, service: MusicService): any {
  const serviceNames: Record<string, string> = {
    spotify: 'Spotify',
    apple: 'Apple Music',
    youtube: 'YouTube Music',
    all: 'Music'
  };

  const availableServices: string[] = [];
  if (song.spotifyUrl) availableServices.push('Spotify');
  if (song.youtubeMusicUrl) availableServices.push('YouTube Music');
  if (song.appleMusicUrl) availableServices.push('Apple Music');

  if (availableServices.length === 0) {
    return {
      content: `❌ Found "${song.title}" by ${song.artist}, but no streaming links are available. Try a different song.`
    };
  }

  return {
    content: `❌ **${serviceNames[service]}** link not available for "${song.title}" by ${song.artist}.\n\n📧 Available on: ${availableServices.join(', ')}\n\nRun the command without specifying a service to get available links.`
  };
}
