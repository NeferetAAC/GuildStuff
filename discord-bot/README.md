# ArcheAge Discord Bot

A Discord slash-command app backed by the Tirwyn Supabase project. Supabase Edge Functions handle the commands, so your PC does not need to stay on.

## Commands

- /register — register your Discord account in the current server.
- /add character name:<name> — add a character name to your roster.
- /add details character:<character> class:<class> level:<level> playstyle:<PvP or PvE> — fill in a character’s details. Choose the character from autocomplete. All three details are needed the first time; afterward, supply only the field(s) you want to update.
- /profile member:<member> — publicly view that member’s profile and characters.
- /roster page:<number> — publicly browse registered members and characters in pages of 10.
- /view members page:<number> — publicly list registered members with characters, classes, levels, and playstyles.
- /event event:<Crimson Rift | Burial Nightmare | Daily Reset> — show the daily schedule, set in GMT+8 and displayed in each viewer’s local time.

Registration and edits reply privately. Profile, roster, and view members replies are visible to the server.

## Supabase Edge Function

The interaction handler is deployed at:

https://naywwmhjqihbyeqkumod.supabase.co/functions/v1/archeage-discord

In the Discord Developer Portal:

1. On General Information, copy the Public Key. In Supabase Edge Function Secrets, add it as DISCORD_PUBLIC_KEY.
2. Make sure DISCORD_BOT_TOKEN and DISCORD_CLIENT_ID are also present in Supabase Edge Function Secrets. These let the function publish the slash commands without your PC.
3. Set the URL above as the Discord app’s Interactions Endpoint URL and save it. When Discord verifies the endpoint, the function publishes all six slash commands through Discord’s API.
4. Optionally add DISCORD_GUILD_ID to Supabase secrets to publish commands just for your server, so they appear quickly. Without it, commands are registered globally and can take time to propagate.
5. Keep the app installed in the server. The Guild Install context should include applications.commands. Set Administrator there if you want the bot user to have it.

The function validates Discord’s Ed25519 signatures before handling interactions. Supabase provides the server-side database key to the function. Do not put a Supabase secret key in Discord or in a public repository.

## Local fallback

If you ever need to manually publish commands from a computer, copy discord-bot/.env.example to discord-bot/.env, enter the Discord bot token, application ID, and optional server ID, then run npm install and npm run deploy:commands from the discord-bot folder. Never commit .env or share the bot token.

The schema is already installed in Tirwyn. The tables have RLS enabled and deny access to anon and authenticated roles; the Edge Function uses its server-only Supabase credentials. Discord IDs are stored as text to avoid numeric precision loss.
