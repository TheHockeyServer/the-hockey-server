# RANKD Website Registration

The RANKD website uses Discord OAuth2 to verify player identity before allowing website registration.

## Discord Developer Portal

Open the RANKD bot application and add this OAuth2 redirect:

```text
https://the-hockey-server-production.up.railway.app/auth/discord/callback
```

The website requests only the Discord `identify` OAuth scope. Players must already be members of the
RANKD Discord server before registration can assign roles.

## Railway Variables

Add these variables to the RANKD bot service:

```text
DISCORD_CLIENT_SECRET=<Discord application client secret>
DISCORD_REDIRECT_URI=https://the-hockey-server-production.up.railway.app/auth/discord/callback
PUBLIC_BASE_URL=https://the-hockey-server-production.up.railway.app
SESSION_SECRET=<long random secret>
```

Generate a session secret locally with:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Existing variables are still required:

```text
CLIENT_ID=<Discord application ID>
DISCORD_TOKEN=<Discord bot token>
GUILD_ID=<RANKD Discord server ID>
```

Legacy Railway setups using `GUID_ID` are also supported, but `GUILD_ID` is the preferred spelling.

## Registration Behavior

- Public profiles and leaderboards remain viewable without login.
- Website registration requires Discord login.
- Registering as a player initializes the player at 2500 ELO, assigns `RANKD Player`, and removes
  `UNVERIFIED`.
- Registering a club initializes the player at 2500 ELO, attaches or creates the club, assigns
  `RANKD Verified`, and removes `UNVERIFIED`.
- Multiple players may attach themselves to the same existing Core ELO club ID.
