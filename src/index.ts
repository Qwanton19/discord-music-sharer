import express from 'express';
import { verifyKey } from 'discord-interactions';
import { InteractionType, InteractionResponseType, MessageFlags } from 'discord-api-types/v10';
import { searchSong } from './music-search';
import { buildSongEmbed, buildSelectionMessage, buildNoResultsMessage, buildServiceUnavailableMessage } from './embeds';
import { Song, MusicService } from './types';
import 'dotenv/config';

const app = express();

app.use(express.json({ verify: (req: any, res, buf) => {
  req.rawBody = buf;
}}));

async function verifyDiscordRequest(req: any): Promise<boolean> {
  const signature = req.get('X-Signature-Ed25519');
  const timestamp = req.get('X-Signature-Timestamp');
  
  if (!signature || !timestamp) return false;
  
  const publicKey = process.env.DISCORD_PUBLIC_KEY;
  if (!publicKey) return false;
  
  const body = req.rawBody?.toString('utf8') || JSON.stringify(req.body);
  
  return verifyKey(body, signature, timestamp, publicKey);
}

function getUsername(interaction: any): string {
  if (interaction.user) {
    if (interaction.user.global_name) return interaction.user.global_name;
    if (interaction.user.username) return interaction.user.username;
  }
  
  if (interaction.member?.user) {
    if (interaction.member.user.global_name) return interaction.member.user.global_name;
    if (interaction.member.user.username) return interaction.member.user.username;
  }
  
  console.error('Could not extract username from interaction:', JSON.stringify(interaction));
  return 'A user';
}

app.post('/interactions', async (req, res) => {
  if (!await verifyDiscordRequest(req)) {
    res.status(401).send('Invalid request signature');
    return;
  }

  const interaction = req.body;

  if (interaction.type === InteractionType.Ping) {
    res.json({ type: InteractionResponseType.Pong });
    return;
  }

  if (interaction.type === InteractionType.ApplicationCommand) {
    const { data } = interaction;
    const username = getUsername(interaction);

    if (data?.name === 'sharemusic') {
      await handleShareMusic(interaction, username, res);
      return;
    }

    res.json({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: { content: 'Unknown command', flags: MessageFlags.Ephemeral }
    });
    return;
  }

  if (interaction.type === InteractionType.MessageComponent) {
    const { data } = interaction;
    
    if (data?.custom_id?.startsWith('select_')) {
      await handleSongSelection(interaction, data.custom_id, res);
      return;
    }
  }

  res.status(400).send('Unhandled interaction type');
});

async function handleShareMusic(interaction: any, username: string, res: any) {
  const { data, channel_id } = interaction;
  const chatData = data as { options?: Array<{ name: string; value: string }> };
  const options = chatData?.options || [];

  let songTitle = '';
  let artistName: string | undefined;
  let service = 'all';

  for (const opt of options) {
    if (opt.name === 'song') songTitle = opt.value;
    if (opt.name === 'artist') artistName = opt.value;
    if (opt.name === 'service') service = opt.value;
  }

  const token = interaction.token;
  const appId = process.env.DISCORD_APP_ID;

  try {
    const songs = await searchSong(songTitle, artistName);

    if (songs.length === 0) {
      res.json({
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          ...buildNoResultsMessage(`${songTitle}${artistName ? ` by ${artistName}` : ''}`),
          flags: MessageFlags.Ephemeral
        }
      });
      return;
    }

    if (service !== 'all') {
      const song = songs[0];
      const hasServiceLink = getServiceLink(song, service);

      if (!hasServiceLink) {
        res.json({
          type: InteractionResponseType.ChannelMessageWithSource,
          data: {
            ...buildServiceUnavailableMessage(song, service as MusicService),
            flags: MessageFlags.Ephemeral
          }
        });
        return;
      }
    }

    if (songs.length === 1 || (artistName && songs.length > 0)) {
      const song = songs[0];
      const response = buildSongEmbed(song, username);
      
      res.json({
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: `🎵 **${username}** shared a song!`,
          ...response
        }
      });
      return;
    }

    res.json({
      type: InteractionResponseType.DeferredChannelMessageWithSource,
      data: { flags: MessageFlags.Ephemeral }
    });

    const selectionMessage = buildSelectionMessage(songs.slice(0, 3), username, channel_id || '', token);
    await sendEphemeralFollowUp(token, appId, selectionMessage);

  } catch (error) {
    console.error('Error in handleShareMusic:', error);
    res.json({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: 'An error occurred while searching for songs. Please try again.',
        flags: MessageFlags.Ephemeral
      }
    });
  }
}

async function handleSongSelection(interaction: any, customId: string, res: any) {
  const parts = customId.split('_');
  
  if (parts.length < 5) {
    res.json({
      type: InteractionResponseType.UpdateMessage,
      data: { content: 'Invalid selection', components: [] }
    });
    return;
  }

  const index = parseInt(parts[1]);
  const title = decodeURIComponent(parts[2]);
  const artist = decodeURIComponent(parts[3]);
  const channelId = parts[4];
  const originalToken = parts[5];
  const token = interaction.token;
  const appId = process.env.DISCORD_APP_ID;
  const username = getUsername(interaction);

  res.json({
    type: InteractionResponseType.UpdateMessage,
    data: {
      content: `📤 Song shared! See message below.`,
      embeds: [],
      components: []
    }
  });

  try {
    const songs = await searchSong(title, artist);
    const selectedSong = songs[index] || songs[0];

    if (selectedSong) {
      const response = buildSongEmbed(selectedSong, username);
      await sendWebhookMessage(appId, originalToken, {
        content: `🎵 **${username}** shared a song!`,
        ...response
      });
    }
  } catch (error) {
    console.error('Error in handleSongSelection:', error);
  }
}

function getServiceLink(song: any, service: string): string | undefined {
  switch (service) {
    case 'spotify': return song.spotifyUrl;
    case 'apple': return song.appleMusicUrl;
    case 'youtube': return song.youtubeMusicUrl;
    default: return undefined;
  }
}

async function sendEphemeralFollowUp(token: string, appId: string | undefined, data: any) {
  const url = `https://discord.com/api/v10/webhooks/${appId}/${token}`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...data, flags: MessageFlags.Ephemeral })
  });
}

async function sendWebhookMessage(appId: string | undefined, token: string, data: any) {
  const url = `https://discord.com/api/v10/webhooks/${appId}/${token}`;
  console.log('Sending public webhook message...');
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    console.error('Webhook message failed:', response.status, await response.text());
  }
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = parseInt(process.env.PORT || '3000');
app.listen(PORT, () => console.log(`Discord Music Sharer running on port ${PORT}`));

export default app;
