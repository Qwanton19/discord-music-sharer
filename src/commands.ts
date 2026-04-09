export const SHARE_MUSIC_COMMAND = {
  name: 'sharemusic',
  description: 'Share a song with links to Spotify, YouTube Music, and Apple Music',
  integration_types: [0, 1],
  contexts: [0, 1, 2],
  options: [
    {
      name: 'song',
      description: 'The song title to search for',
      type: 3,
      required: true,
      min_length: 1,
      max_length: 100
    },
    {
      name: 'artist',
      description: 'The artist name',
      type: 3,
      required: true,
      min_length: 1,
      max_length: 100
    },
    {
      name: 'service',
      description: 'Get a link for a specific music service only',
      type: 3,
      required: false,
      choices: [
        { name: 'Spotify', value: 'spotify' },
        { name: 'YouTube Music', value: 'youtube' },
        { name: 'Apple Music', value: 'apple' }
      ]
    }
  ]
};

export const commands = [SHARE_MUSIC_COMMAND];
