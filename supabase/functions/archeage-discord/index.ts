import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.119.0";

const discordPublicKey = Deno.env.get("DISCORD_PUBLIC_KEY") ?? "";
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const secretKeysRaw = Deno.env.get("SUPABASE_SECRET_KEYS");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
let supabaseKey = serviceRoleKey ?? "";
if (secretKeysRaw) {
  try {
    const keys = JSON.parse(secretKeysRaw);
    supabaseKey = keys.default ?? Object.values(keys)[0] ?? supabaseKey;
  } catch {
    console.error("Could not read Supabase secret keys.");
  }
}
const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;

const discordBotToken = Deno.env.get("DISCORD_BOT_TOKEN") ?? "";
const discordApplicationId = Deno.env.get("DISCORD_CLIENT_ID") ?? "";
const discordGuildId = Deno.env.get("DISCORD_GUILD_ID") ?? "";

const commandDefinitions = [
  {
    name: "register",
    description: "Register your Discord account for the ArcheAge roster.",
  },
  {
    name: "add",
    description: "Add a character or update one of your character levels.",
    options: [
      {
        type: 1,
        name: "character",
        description: "Add a character to your roster.",
        options: [
          { type: 3, name: "name", description: "Your in-game character name.", required: true, max_length: 40 },
          { type: 3, name: "class", description: "Your character class.", required: true, max_length: 40 },
          { type: 4, name: "level", description: "Starting character level (optional).", min_value: 1, max_value: 1000 },
        ],
      },
      {
        type: 1,
        name: "level",
        description: "Set the level for one of your registered characters.",
        options: [
          { type: 3, name: "character", description: "Choose one of your registered characters.", required: true, autocomplete: true },
          { type: 4, name: "level", description: "Current character level.", required: true, min_value: 1, max_value: 1000 },
        ],
      },
    ],
  },
  {
    name: "profile",
    description: "View a member’s registered ArcheAge characters.",
    options: [
      { type: 6, name: "member", description: "The Discord member to look up.", required: true },
    ],
  },
  {
    name: "roster",
    description: "View registered ArcheAge characters in this server.",
    options: [
      { type: 4, name: "page", description: "Roster page number.", min_value: 1 },
    ],
  },
  {
    name: "view",
    description: "View server member characters and classes.",
    options: [
      {
        type: 1,
        name: "members",
        description: "List registered members, characters, classes, and levels.",
        options: [
          { type: 4, name: "page", description: "Roster page number.", min_value: 1 },
        ],
      },
    ],
  },
]; 

async function registerCommands() {
  if (!discordBotToken || !discordApplicationId) {
    throw new Error("Missing DISCORD_BOT_TOKEN or DISCORD_CLIENT_ID in Supabase Edge Function secrets.");
  }
  const route = "https://discord.com/api/v10/applications/" + discordApplicationId
    + (discordGuildId ? "/guilds/" + discordGuildId : "")
    + "/commands";
  const response = await fetch(route, {
    method: "PUT",
    headers: {
      "Authorization": "Bot " + discordBotToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commandDefinitions),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error("Discord returned HTTP " + response.status + ": " + detail.slice(0, 500));
  }
  console.log("Registered " + commandDefinitions.length + " slash commands"
    + (discordGuildId ? " for the configured server." : " globally."));
}

const PAGE_SIZE = 10;
const EPHEMERAL = 64;

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function decodeHex(value) {
  if (!/^[0-9a-f]+$/i.test(value) || value.length % 2 !== 0) return null;
  const bytes = new Uint8Array(value.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(value.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

async function isValidDiscordRequest(request, body) {
  if (!discordPublicKey) return false;
  const signature = decodeHex(request.headers.get("x-signature-ed25519") ?? "");
  const timestamp = request.headers.get("x-signature-timestamp") ?? "";
  const keyBytes = decodeHex(discordPublicKey);
  if (!signature || !keyBytes || !/^\d+$/.test(timestamp)) return false;
  const age = Math.abs(Date.now() - Number(timestamp) * 1000);
  if (!Number.isFinite(age) || age > 5 * 60 * 1000) return false;
  try {
    const key = await crypto.subtle.importKey("raw", keyBytes, { name: "Ed25519" }, false, ["verify"]);
    const message = new TextEncoder().encode(timestamp + body);
    return await crypto.subtle.verify({ name: "Ed25519" }, key, signature, message);
  } catch {
    return false;
  }
}

function escapeMarkdown(value) {
  return String(value ?? "").replace(/([\\_*~|\x60>])/g, "\\$1");
}

function getOption(options, name) {
  return (options ?? []).find((item) => item.name === name);
}

function getSubcommand(options) {
  const item = (options ?? []).find((option) => option.type === 1);
  return item ? { name: item.name, options: item.options ?? [] } : { name: "", options: [] };
}

function interactionReply(content, ephemeral = false) {
  return {
    type: 4,
    data: {
      content,
      ...(ephemeral ? { flags: EPHEMERAL } : {}),
      allowed_mentions: { parse: [] },
    },
  };
}

function embedReply(embed, ephemeral = false) {
  return {
    type: 4,
    data: {
      embeds: [embed],
      ...(ephemeral ? { flags: EPHEMERAL } : {}),
      allowed_mentions: { parse: [] },
    },
  };
}

function requireSupabase() {
  if (!supabase) throw new Error("Supabase server credentials are not available.");
  return supabase;
}

async function getMember(guildId, userId) {
  const db = requireSupabase();
  const { data, error } = await db.from("discord_members")
    .select("id,guild_id,discord_user_id,discord_username")
    .eq("guild_id", guildId)
    .eq("discord_user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function ensureMember(guildId, user) {
  const db = requireSupabase();
  const { data, error } = await db.from("discord_members")
    .upsert({
      guild_id: guildId,
      discord_user_id: user.id,
      discord_username: user.username ?? "Discord member",
    }, { onConflict: "guild_id,discord_user_id" })
    .select("id,guild_id,discord_user_id,discord_username")
    .single();
  if (error) throw error;
  return data;
}

async function getCharacters(memberId) {
  const db = requireSupabase();
  const { data, error } = await db.from("discord_characters")
    .select("id,character_name,class_name,level")
    .eq("member_id", memberId)
    .order("character_name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

async function handleAutocomplete(interaction) {
  const guildId = interaction.guild_id;
  const user = interaction.member?.user ?? interaction.user;
  const sub = getSubcommand(interaction.data.options);
  if (!guildId || !user?.id || sub.name !== "level") return { type: 8, data: { choices: [] } };
  const member = await getMember(guildId, user.id);
  if (!member) return { type: 8, data: { choices: [] } };
  const characters = await getCharacters(member.id);
  const focused = (sub.options.find((option) => option.focused)?.value ?? "").toLowerCase();
  const choices = characters
    .filter((character) => character.character_name.toLowerCase().includes(focused))
    .slice(0, 25)
    .map((character) => ({ name: character.character_name.slice(0, 100), value: character.character_name }));
  return { type: 8, data: { choices } };
}

async function handleCommand(interaction) {
  const data = interaction.data ?? {};
  const guildId = interaction.guild_id;
  const user = interaction.member?.user ?? interaction.user;
  if (!guildId) return interactionReply("Use this command in an ArcheAge Discord server.", true);

  if (data.name === "register") {
    await ensureMember(guildId, user);
    return interactionReply("You’re registered. Add a character with /add character.", true);
  }

  if (data.name === "add") {
    const sub = getSubcommand(data.options);
    const member = await getMember(guildId, user.id);
    if (!member) return interactionReply("Run /register first, then add your character.", true);

    if (sub.name === "character") {
      const characterName = String(getOption(sub.options, "name")?.value ?? "").trim();
      const className = String(getOption(sub.options, "class")?.value ?? "").trim();
      const requestedLevel = getOption(sub.options, "level")?.value;
      const newCharacter = {
        member_id: member.id,
        character_name: characterName,
        class_name: className,
      };
      if (requestedLevel !== undefined) newCharacter.level = Number(requestedLevel);
      const { error } = await requireSupabase().from("discord_characters").insert(newCharacter);
      if (error?.code === "23505") {
        return interactionReply("You already added **" + escapeMarkdown(characterName) + "**. Use /add level to update its level.", true);
      }
      if (error) throw error;
      const startingLevel = requestedLevel === undefined ? 1 : Number(requestedLevel);
      return interactionReply("Added **" + escapeMarkdown(characterName) + "** (" + escapeMarkdown(className) + "), level " + startingLevel + ". You can update it later with /add level.", true);
    }

    if (sub.name === "level") {
      const requestedName = String(getOption(sub.options, "character")?.value ?? "").trim();
      const characters = await getCharacters(member.id);
      const character = characters.find((item) => item.character_name.toLowerCase() === requestedName.toLowerCase());
      if (!character) return interactionReply("I couldn’t find that character in your roster.", true);
      const level = Number(getOption(sub.options, "level")?.value);
      const { error } = await requireSupabase().from("discord_characters")
        .update({ level, updated_at: new Date().toISOString() })
        .eq("id", character.id);
      if (error) throw error;
      return interactionReply("Updated **" + escapeMarkdown(character.character_name) + "** to level " + level + ".", true);
    }
  }

  if (data.name === "profile") {
    const targetId = String(getOption(data.options, "member")?.value ?? "");
    const resolvedUser = interaction.data?.resolved?.users?.[targetId];
    const member = await getMember(guildId, targetId);
    if (!member) {
      const label = resolvedUser?.username ?? "This member";
      return interactionReply(label + " hasn’t registered in this server yet.");
    }
    const characters = await getCharacters(member.id);
    const rows = characters.length
      ? characters.map((character) => "**" + escapeMarkdown(character.character_name) + "** — " + escapeMarkdown(character.class_name) + ", Lv. " + character.level).join("\n")
      : "No characters have been added yet.";
    return embedReply({
      color: 0x39a86b,
      title: (resolvedUser?.username ?? member.discord_username ?? "Member") + "’s ArcheAge Profile",
      description: rows,
    });
  }

  const viewMembers = data.name === "view" && getSubcommand(data.options).name === "members";
  if (data.name === "roster" || viewMembers) {
    const commandOptions = viewMembers ? getSubcommand(data.options).options : data.options;
    const page = Number(getOption(commandOptions, "page")?.value ?? 1);
    const first = (page - 1) * PAGE_SIZE;
    const db = requireSupabase();
    const { data: members, count, error } = await db.from("discord_members")
      .select("id,discord_user_id,discord_username", { count: "exact" })
      .eq("guild_id", guildId)
      .order("discord_username", { ascending: true })
      .range(first, first + PAGE_SIZE - 1);
    if (error) throw error;
    if (!members?.length) {
      return interactionReply(page === 1 ? "No one has registered in this server yet." : "There are no more roster pages.");
    }
    const { data: characters, error: characterError } = await db.from("discord_characters")
      .select("member_id,character_name,class_name,level")
      .in("member_id", members.map((member) => member.id))
      .order("character_name", { ascending: true });
    if (characterError) throw characterError;
    const byMember = new Map(members.map((member) => [member.id, []]));
    for (const character of characters ?? []) byMember.get(character.member_id)?.push(character);
    const fields = members.map((member) => {
      const rows = byMember.get(member.id) ?? [];
      const value = rows.length
        ? rows.map((character) => escapeMarkdown(character.character_name) + " — " + escapeMarkdown(character.class_name) + ", Lv. " + character.level).join("\n")
        : "No characters added yet.";
      return {
        name: String(member.discord_username ?? "Discord member").slice(0, 256),
        value: value.slice(0, 1024),
        inline: false,
      };
    });
    const total = count ?? members.length;
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    return embedReply({
      color: 0x39a86b,
      title: viewMembers ? "ArcheAge Server Members" : "ArcheAge Server Roster",
      description: "Page " + page + " of " + pages + " · " + total + " registered member" + (total === 1 ? "" : "s"),
      fields,
    });
  }

  return interactionReply("I don’t recognize that command.", true);
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Discord interactions endpoint is ready.", { status: 200 });
  const body = await request.text();
  if (!await isValidDiscordRequest(request, body)) return new Response("Invalid Discord request signature.", { status: 401 });

  let interaction;
  try {
    interaction = JSON.parse(body);
  } catch {
    return new Response("Invalid JSON.", { status: 400 });
  }

  if (interaction.type === 1) {
    try {
      await registerCommands();
    } catch (error) {
      console.error("Slash-command registration failed:", error?.message ?? "unknown error");
    }
    return jsonResponse({ type: 1 });
  }
  if (interaction.type === 4) {
    try {
      return jsonResponse(await handleAutocomplete(interaction));
    } catch (error) {
      console.error("Autocomplete failed:", error?.message ?? "unknown error");
      return jsonResponse({ type: 8, data: { choices: [] } });
    }
  }
  if (interaction.type === 2) {
    try {
      return jsonResponse(await handleCommand(interaction));
    } catch (error) {
      console.error("Interaction failed:", error?.message ?? "unknown error");
      return jsonResponse(interactionReply("Something went wrong while saving or loading the roster. Please try again.", true));
    }
  }
  return jsonResponse({ type: 4, data: { content: "Unsupported interaction.", flags: EPHEMERAL } });
});
