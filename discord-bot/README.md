# ArcheAge Discord Bot

A Discord slash-command app backed by the Tirwyn Supabase project. Supabase Edge Functions handle the commands, so your PC does not need to stay on.

## Commands

- /add character name:<name> — add a character; this also registers you automatically.
- /add details character:<character> class:<class> level:<level> playstyle:<PvE | PvP | PvX> — fill in a character’s details. All fields are needed the first time; afterward, supply only the field(s) you want to update.
- /view member:<member> — view one member’s characters. Leave member blank to browse the server roster; page is optional.
- /event event:<Crimson Rift | Burial Nightmare | Daily Reset> — show the daily schedule, set in GMT+8 and displayed in each viewer’s local time.

Adding a character and editing details reply privately. Views and event schedules are visible to the server.

## Supabase Edge Function

The interaction handler is deployed at:

https://naywwmhjqihbyeqkumod.supabase.co/functions/v1/archeage-discord

In the Discord Developer Portal:

1. On General Information, copy the Public Key. In Supabase Edge Function Secrets, add it as DISCORD_PUBLIC_KEY.
2. Make sure DISCORD_BOT_TOKEN and DISCORD_CLIENT_ID are also present in Supabase Edge Function Secrets. These let the function publish slash commands without your PC.
3. Keep the app installed in the server with the `applications.commands` scope.
4. To refresh global commands after a change, add a new query value such as `?setup=6` to the Interactions Endpoint URL and save. Discord’s verification ping triggers command registration. Global commands can take a little while to propagate.

The function validates Discord’s Ed25519 signatures before handling interactions. Supabase provides the server-side database key to the function. Do not put a Supabase secret key in Discord or in a public repository.

## Database

The schema is in `discord-bot/supabase/schema.sql`. Character rows allow name-only creation, then class, level, and playstyle are filled in with `/add details`. Tables have RLS enabled and deny access to anon and authenticated roles; the Edge Function uses server-only Supabase credentials.
