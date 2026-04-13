# Discord Music Sharer

A Discord app for sharing music with friends who use different streaming platforms so you don't have to go hunting for links on each service. Finds and shares links instantly, making it easy to share what you're listening to regardless of which platform your friends use.

[use it here :3](https://discord.com/oauth2/authorize?client_id=1491727102956015656)

## Usage

```
/sharemusic song: [song title] artist: [artist name]
```
Returns all streaming platforms, or add service to just return a specific one

```
/sharemusic song: [song title] artist: [artist name] service: spotify
```

## Tech Stack

- Node.js with TypeScript
- Express.js for HTTP interactions
- Spotify Web API
- YouTube Music API (ytmusic-api)
- Hosted on Render with UptimeRobot for uptime monitoring

## How It Works

Uses Discord HTTP interactions instead of a bot gateway so it can respond to slash commands without maintaining a persistent WebSocket connection. Search all apps at the same time, then fuzzy matches the results to find the correct song before returning a clean embed with clickable links to platforms. Made to be a user-installable app, meaning people can add it to their Discord account and use it in any server or DM without needing to invite the bot
