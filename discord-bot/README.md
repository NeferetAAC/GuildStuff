# ArcheAge Discord Bot

A small Discord bot backed by the Tirwyn Supabase project. It registers members, stores multiple characters per member, updates character levels, and lets anyone in the same Discord server view a profile or paged roster.

## Commands

- `/register` — register your Discord account in the current server.
- `/add character name:<name> class:<class>` — add a character to your own roster.
- `/add level character:<character> level:<level>` — update one of your characters. The character option autocompletes from your roster.
- `/profile member:<member>` — publicly view that member’s profile and characters.
- `/roster page:<number>` — publicly browse registered members and characters in pages of 10.

Registration and edits reply privately. Profile and roster replies are visible to the server.

## Set up

1. Create a Discord application in the [Discord Developer Portal](https://discord.com/developers/applications), add a bot, and copy the bot token. Keep it private.
2. Invite the bot to your server with the `bot` and `applications.commands` scopes. It needs permission to use application commands and post interaction replies in the channels where you will use it.
3. Copy `.env.example` to `.env`. Add the bot token and application ID. Set `DISCORD_GUILD_ID` for fast command updates in one test server; omit it to register commands globally.
4. In Supabase, open **Project Settings → API Keys** and create/copy a **secret key**. Put it in `SUPABASE_SECRET_KEY`; keep it in this server’s environment only. The project URL is already set to Tirwyn.
5. The schema is already installed in Tirwyn. The tables have RLS enabled, deny `anon` and `authenticated`, and grant access to the server-side `service_role`.
6. Install dependencies and register commands:

   ```sh
   npm install
   npm run deploy:commands
   npm start
   ```

Keep `.env` out of GitHub and store these values as secrets if deploying to a host. Never use the Supabase secret key in a webpage, browser code, or public repository. Discord snowflake IDs are stored as text to avoid numeric precision loss.
