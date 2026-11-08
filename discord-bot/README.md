# ArcheAge Discord Bot

A Discord slash-command app backed by the Tirwyn Supabase project. Supabase Edge Functions handle the commands, so your PC does not need to stay on.

## Commands

- /register — register your Discord account in the current server.
- /add character name:<name> class:<class> — add a character to your own roster.
- /add level character:<character> level:<level> — update one of your characters; the character field autocompletes.
- /profile member:<member> — publicly view that member’s profile and characters.
- /roster page:<number> — publicly browse registered members and characters in pages of 10.

Registration and edits reply privately. Profile and roster replies are visible to the server.

## Supabase Edge Function

The interaction handler is deployed at:

https://naywwmhjqihbyeqkumod.supabase.co/functions/v1/archeage-discord

In the Discord Developer Portal:

1. Open your application’s General Information page and copy its Public Key.
2. In Supabase, open Project Settings → Edge Functions → Secrets and add DISCORD_PUBLIC_KEY with that value.
3. Return to Discord General Information, paste the URL above into Interactions Endpoint URL, and save. Discord should validate it.
4. Keep the app installed in the server. The Guild Install context should include applications.commands. If you want the bot user to have Administrator, configure that permission in the Guild Install settings and reinstall/authorize it in the server.

The function validates Discord’s Ed25519 signatures before processing requests. Supabase provides the server-side database key to the function; do not put a Supabase secret key in Discord or in a public repository.

## Register slash commands once

The command definitions are in the discord-bot folder. You only need a computer briefly to register the commands with Discord; your PC does not need to remain on afterwards.

1. Copy discord-bot/.env.example to discord-bot/.env.
2. Fill in DISCORD_BOT_TOKEN, DISCORD_CLIENT_ID, and DISCORD_GUILD_ID. The token is needed for this one-time registration step and must stay private.
3. Open a terminal in discord-bot and run:

   npm install
   npm run deploy:commands

Use the Discord Application ID as DISCORD_CLIENT_ID and your test server’s ID as DISCORD_GUILD_ID. The Guild ID makes the commands appear quickly in that server. Do not run npm start; that starts the old Gateway version.

The schema is already installed in Tirwyn. The tables have RLS enabled and deny access to anon and authenticated roles; the Edge Function uses its server-only Supabase credentials. Discord IDs are stored as text to avoid numeric precision loss.
