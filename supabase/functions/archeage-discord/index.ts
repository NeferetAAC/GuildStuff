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
const alertChannelId = Deno.env.get("DISCORD_ALERT_CHANNEL_ID") ?? "1566846347724980235";
let cronApiKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
try {
  const publishableKeys = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}");
  cronApiKey = publishableKeys.default ?? cronApiKey;
} catch {
  console.error("Could not read Supabase publishable keys for scheduled alerts.");
}


const commandDefinitions = [
  {
    name: "add",
    description: "Add a character or update its details.",
    options: [
      {
        type: 1,
        name: "character",
        description: "Add a character name to your roster.",
        options: [
          { type: 3, name: "name", description: "Your in-game character name.", required: true, max_length: 40 },
        ],
      },
      {
        type: 1,
        name: "details",
        description: "Set or update class, level, and playstyle.",
        options: [
          { type: 3, name: "character", description: "Choose one of your characters.", required: true, autocomplete: true },
          {
            type: 3, name: "class", description: "Choose your character class.",
            choices: [
              { name: "Ranger", value: "Ranger" },
              { name: "Berserker", value: "Berserker" },
              { name: "Warrior", value: "Warrior" },
              { name: "Mage", value: "Mage" },
            ],
          },
          { type: 4, name: "level", description: "Current character level.", min_value: 1, max_value: 1000 },
          {
            type: 3, name: "playstyle", description: "Choose PvE, PvP, or PvX.",
            choices: [
              { name: "PvE", value: "pve" },
              { name: "PvP", value: "pvp" },
              { name: "PvX", value: "pvx" },
            ],
          },
        ],
      },
    ],
  },
  {
    name: "view",
    description: "View the server roster or one member’s profile.",
    options: [
      { type: 6, name: "member", description: "Choose a member; leave blank to see the roster." },
      { type: 4, name: "page", description: "Roster page when viewing all members.", min_value: 1 },
    ],
  },
  {
    name: "event",
    description: "View event schedules in your local time.",
    options: [
      {
        type: 3,
        name: "event",
        description: "Choose an event schedule.",
        required: true,
        choices: [
          { name: "Crimson Rift", value: "crimson_rift" },
          { name: "Burial Nightmare", value: "burial_nightmare" },
          { name: "Daily Reset", value: "daily_reset" },
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
    .select("id,character_name,class_name,level,playstyle")
    .eq("member_id", memberId)
    .order("character_name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

async function handleAutocomplete(interaction) {
  const guildId = interaction.guild_id;
  const user = interaction.member?.user ?? interaction.user;
  const sub = getSubcommand(interaction.data.options);
  if (!guildId || !user?.id || sub.name !== "details") return { type: 8, data: { choices: [] } };
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
  if (data.name === "add") {
    const sub = getSubcommand(data.options);
    if (sub.name === "character") {
      const member = await ensureMember(guildId, user);
      const characterName = String(getOption(sub.options, "name")?.value ?? "").trim();
      const { error } = await requireSupabase().from("discord_characters").insert({
        member_id: member.id,
        character_name: characterName,
      });
      if (error?.code === "23505") return interactionReply("You already added **" + escapeMarkdown(characterName) + "**. Use /add details to update it.", true);
      if (error) throw error;
      return interactionReply("Added **" + escapeMarkdown(characterName) + "**. Now use /add details to select it and set its class, level, and PvE/PvP/PvX playstyle.", true);
    }

    if (sub.name === "details") {
      const member = await getMember(guildId, user.id);
      if (!member) return interactionReply("Start with /add character to add your first character.", true);
      const requestedName = String(getOption(sub.options, "character")?.value ?? "").trim();
      const characters = await getCharacters(member.id);
      const character = characters.find((item) => item.character_name.toLowerCase() === requestedName.toLowerCase());
      if (!character) return interactionReply("I couldn’t find that character in your roster.", true);
      const classOption = getOption(sub.options, "class");
      const levelOption = getOption(sub.options, "level");
      const playstyleOption = getOption(sub.options, "playstyle");
      const className = classOption ? String(classOption.value).trim() : character.class_name;
      const level = levelOption ? Number(levelOption.value) : character.level;
      const playstyle = playstyleOption ? String(playstyleOption.value) : character.playstyle;
      const needsInitialDetails = !character.class_name || character.level == null || !character.playstyle;
      if (needsInitialDetails && (!classOption || !levelOption || !playstyleOption)) {
        return interactionReply("For the first setup, choose a class, enter a level, and choose PvE, PvP, or PvX. You can update individual fields afterward.", true);
      }
      if (!className || !level || !playstyle) {
        return interactionReply("Please provide a valid class, level, and PvE/PvP/PvX playstyle.", true);
      }
      const { error } = await requireSupabase().from("discord_characters")
        .update({ class_name: className, level, playstyle, updated_at: new Date().toISOString() })
        .eq("id", character.id)
        .eq("member_id", member.id);
      if (error) throw error;
      return interactionReply("Updated **" + escapeMarkdown(character.character_name) + "** — " + escapeMarkdown(className) + ", level " + level + ", " + ({pvp:"PvP",pve:"PvE",pvx:"PvX"}[playstyle] ?? "PvX") + ".", true);
    }
  }

  if (data.name === "view") {
    const targetId = String(getOption(data.options, "member")?.value ?? "");
    if (targetId) {
      const resolvedUser = interaction.data?.resolved?.users?.[targetId];
      const member = await getMember(guildId, targetId);
      if (!member) return interactionReply((resolvedUser?.username ?? "This member") + " hasn’t added a character yet.");
      const characters = await getCharacters(member.id);
      const rows = characters.length
        ? characters.map((character) => "**" + escapeMarkdown(character.character_name) + "** — " + (character.class_name ? escapeMarkdown(character.class_name) + ", Lv. " + character.level + (character.playstyle ? ", " + ({pvp:"PvP",pve:"PvE",pvx:"PvX"}[character.playstyle] ?? "") : "") : "Details pending")).join("\n")
        : "No characters have been added yet.";
      return embedReply({ color: 0x39a86b, title: (resolvedUser?.username ?? member.discord_username ?? "Member") + "’s ArcheAge Profile", description: rows });
    }

    const page = Number(getOption(data.options, "page")?.value ?? 1);
    const first = (page - 1) * PAGE_SIZE;
    const db = requireSupabase();
    const { data: members, count, error } = await db.from("discord_members")
      .select("id,discord_user_id,discord_username", { count: "exact" })
      .eq("guild_id", guildId)
      .order("discord_username", { ascending: true })
      .range(first, first + PAGE_SIZE - 1);
    if (error) throw error;
    if (!members?.length) return interactionReply(page === 1 ? "No one has added a character yet." : "There are no more roster pages.");
    const { data: characters, error: characterError } = await db.from("discord_characters")
      .select("member_id,character_name,class_name,level,playstyle")
      .in("member_id", members.map((member) => member.id))
      .order("character_name", { ascending: true });
    if (characterError) throw characterError;
    const byMember = new Map(members.map((member) => [member.id, []]));
    for (const character of characters ?? []) byMember.get(character.member_id)?.push(character);
    const fields = members.map((member) => {
      const rows = byMember.get(member.id) ?? [];
      const value = rows.length
        ? rows.map((character) => escapeMarkdown(character.character_name) + " — " + (character.class_name ? escapeMarkdown(character.class_name) + ", Lv. " + character.level + (character.playstyle ? ", " + ({pvp:"PvP",pve:"PvE",pvx:"PvX"}[character.playstyle] ?? "") : "") : "Details pending")).join("\n")
        : "No characters added yet.";
      return { name: String(member.discord_username ?? "Discord member").slice(0, 256), value: value.slice(0, 1024), inline: false };
    });
    const total = count ?? members.length;
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    return embedReply({ color: 0x39a86b, title: "ArcheAge Roster", description: "Page " + page + " of " + pages + " · " + total + " member" + (total === 1 ? "" : "s"), fields });
  }

function singaporeDateKey() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const date = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return date.year + "-" + date.month + "-" + date.day;
}

function nextSingaporeOccurrence(hour) {
  const time = String(hour).padStart(2, "0") + ":00:00";
  let instant = Date.parse(singaporeDateKey() + "T" + time + "+08:00");
  if (instant <= Date.now()) instant += 24 * 60 * 60 * 1000;
  return Math.floor(instant / 1000);
}

function singaporeClockLabel(hour) {
  const hour12 = hour % 12 || 12;
  return hour12 + ":00 " + (hour < 12 ? "AM" : "PM") + " SGT";
}

  if (data.name === "event") {
    const eventKey = String(getOption(data.options, "event")?.value ?? "");
    const schedules = {
      crimson_rift: { name: "Crimson Rift", hours: [1, 3, 8, 13, 15, 20] },
      burial_nightmare: { name: "Burial Nightmare", hours: [5, 10, 17, 22] },
      daily_reset: { name: "Daily Reset", hours: [5] },
    };
    const schedule = schedules[eventKey];
    if (!schedule) return interactionReply("Choose a valid event schedule.", true);
    const rows = schedule.hours.map((hour) =>
      "• " + singaporeClockLabel(hour) + " → <t:" + nextSingaporeOccurrence(hour) + ":t>"
    );
    const message = "**" + schedule.name + " — daily schedule**\n"
      + "Times are set in GMT+8 (Singapore). Discord shows each event in your local time.\n"
      + rows.join("\n");
    return interactionReply(message);
  }



  return interactionReply("I don’t recognize that command.", true);
}

async function runScheduledEventAlerts() {
  if (!discordBotToken || !cronApiKey || !alertChannelId || !supabase) {
    throw new Error("Scheduled alert configuration is incomplete.");
  }
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const dateParts = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const dateKey = dateParts.year + "-" + dateParts.month + "-" + dateParts.day;
  const currentMinute = Math.floor(Date.now() / 60000);
  const schedules = [
    { key: "crimson_rift", name: "Crimson Rift", hours: [1, 3, 8, 13, 15, 20] },
    { key: "burial_nightmare", name: "Burial Nightmare", hours: [5, 10, 17, 22] },
  ];
  let sent = 0;
  const db = supabase;

  for (const schedule of schedules) {
    for (const hour of schedule.hours) {
      const startUnix = Math.floor(Date.parse(dateKey + "T" + String(hour).padStart(2, "0") + ":00:00+08:00") / 1000);
      for (const minutesBefore of [10, 0]) {
        const alertUnix = startUnix - minutesBefore * 60;
        if (Math.floor(alertUnix / 60) !== currentMinute) continue;

        const alertKey = dateKey + ":" + schedule.key + ":" + hour + ":" + minutesBefore;
        const { error: claimError } = await db.from("discord_event_alerts").insert({ alert_key: alertKey });
        if (claimError?.code === "23505") continue;
        if (claimError) throw claimError;

        const content = minutesBefore
          ? "@everyone **" + schedule.name + "** starts in 10 minutes — <t:" + startUnix + ":t> (your local time)."
          : "@everyone **" + schedule.name + " is starting now!** <t:" + startUnix + ":t>";
        try {
          const response = await fetch("https://discord.com/api/v10/channels/" + alertChannelId + "/messages", {
            method: "POST",
            headers: {
              "Authorization": "Bot " + discordBotToken,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              content,
              allowed_mentions: { parse: ["everyone"] },
            }),
          });
          if (!response.ok) {
            const detail = await response.text();
            throw new Error("Discord returned HTTP " + response.status + ": " + detail.slice(0, 300));
          }
          sent += 1;
        } catch (error) {
          await db.from("discord_event_alerts").delete().eq("alert_key", alertKey);
          console.error("Scheduled alert failed for " + alertKey + ":", error?.message ?? "unknown error");
        }
      }
    }
  }
  return { sent };
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Discord interactions endpoint is ready.", { status: 200 });
  const body = await request.text();
  const suppliedApiKey = request.headers.get("apikey") ?? "";
  if (suppliedApiKey && cronApiKey && suppliedApiKey === cronApiKey
      && request.headers.get("x-archeage-scheduled-alerts") === "1") {
    try {
      return jsonResponse(await runScheduledEventAlerts());
    } catch (error) {
      console.error("Scheduled event alerts failed:", error?.message ?? "unknown error");
      return jsonResponse({ error: "Scheduled event alerts failed." }, 500);
    }
  }
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
