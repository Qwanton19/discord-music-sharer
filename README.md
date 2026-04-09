# Discord Music Sharer

A Discord app for sharing songs with links to Spotify and YouTube Music.

## Tech Stack

- Node.js with TypeScript
- Express.js for HTTP interactions
- Spotify Web API
- YouTube Music API (ytmusic-api)
- Hosted on Render with UptimeRobot for uptime monitoring

## How It Works

This app uses Discord HTTP interactions instead of a bot gateway, meaning it can respond to slash commands without maintaining a persistent WebSocket connection. When a user runs `/sharemusic`, the app searches both Spotify and YouTube Music simultaneously, then fuzzy matches the results to find the correct song. It returns a clean embed with clickable links to both platforms.

The app is designed to work as a user-installable app, meaning users can add it to their Discord account and use it in any server or DM without the server needing to invite the bot.

## Setup

1. Create a Discord app at [discord.com/developers](https://discord.com/developers/applications) and get:
   - Application ID
   - Public Key
   - Bot Token

2. Create a Spotify app at [developer.spotify.com](https://developer.spotify.com/dashboard) and get:
   - Client ID
   - Client Secret

3. Set these as environment variables on your hosting platform (Render, Railway, etc.):
   - `DISCORD_APP_ID`
   - `DISCORD_PUBLIC_KEY`
   - `DISCORD_BOT_TOKEN`
   - `SPOTIFY_CLIENT_ID`
   - `SPOTIFY_CLIENT_SECRET`
   - `PORT` (optional, defaults to 3000)

4. Deploy the app and add the interaction endpoint URL to your Discord app settings

5. Run `npm run register` to register the slash command with Discord

## Usage

```
/sharemusic song: [song title] artist: [artist name]
```

Returns an embed with Spotify and YouTube Music links for the specified song.

Optionally, you can specify a service to get a link for just that platform:
```
/sharemusic song: [song title] artist: [artist name] service: spotify
```

## Why

Sharing music with friends who use different streaming platforms required hunting for links on each service. This app finds and shares both links instantly, making it easy to share what you're listening to regardless of which platform your friends use.

## Add to Discord

[Click here to add the app to your Discord account](https://discord.com/oauth2/authorize?client_id=1491727102956015656)
