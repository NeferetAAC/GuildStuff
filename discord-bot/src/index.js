import {
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  escapeMarkdown,
} from 'discord.js';
import { supabase } from './supabase.js';

const { DISCORD_BOT_TOKEN } = process.env;
if (!DISCORD_BOT_TOKEN) throw new Error('Set DISCORD_BOT_TOKEN in the environment.');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const ROSTER_PAGE_SIZE = 10;

function requireGuild(interaction) {
  if (interaction.guildId) return true;
  void interaction.reply({ content: 'Use this command in an ArcheAge Discord server.', ephemeral: true });
  return false;
}

async function getMemberRecord(guildId, userId) {
  const { data, error } = await supabase
    .from('discord_members')
    .select('id, guild_id, discord_user_id, discord_username')
    .eq('guild_id', guildId)
    .eq('discord_user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function ensureMemberRecord(interaction) {
  const { data, error } = await supabase
    .from('discord_members')
    .upsert({
      guild_id: interaction.guildId,
      discord_user_id: interaction.user.id,
      discord_username: interaction.user.username,
    }, { onConflict: 'guild_id,discord_user_id' })
    .select('id, guild_id, discord_user_id, discord_username')
    .single();
  if (error) throw error;
  return data;
}

async function getCharacters(memberId) {
  const { data, error } = await supabase
    .from('discord_characters')
    .select('id, character_name, class_name, level')
    .eq('member_id', memberId)
    .order('character_name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

function formatCharacterList(characters) {
  if (!characters.length) return 'No characters have been added yet.';
  return characters.map((character) =>
    `**${escapeMarkdown(character.character_name)}** — ${escapeMarkdown(character.class_name)}, Lv. ${character.level}`
  ).join('\n');
}

async function handleRegister(interaction) {
  if (!requireGuild(interaction)) return;
  await interaction.deferReply({ ephemeral: true });
  await ensureMemberRecord(interaction);
  await interaction.editReply('You’re registered. Add a character with `/add character`.');
}

async function handleAddCharacter(interaction) {
  if (!requireGuild(interaction)) return;
  await interaction.deferReply({ ephemeral: true });
  const member = await getMemberRecord(interaction.guildId, interaction.user.id);
  if (!member) {
    await interaction.editReply('Run `/register` first, then add your character.');
    return;
  }

  const characterName = interaction.options.getString('name', true).trim();
  const className = interaction.options.getString('class', true).trim();
  const { error } = await supabase.from('discord_characters').insert({
    member_id: member.id,
    character_name: characterName,
    class_name: className,
  });

  if (error?.code === '23505') {
    await interaction.editReply(`You already added **${escapeMarkdown(characterName)}**. Use `/add level` to update its level.`);
    return;
  }
  if (error) throw error;
  await interaction.editReply(`Added **${escapeMarkdown(characterName)}** (${escapeMarkdown(className)}). Set its level with `/add level`.`);
}

async function handleAddLevel(interaction) {
  if (!requireGuild(interaction)) return;
  await interaction.deferReply({ ephemeral: true });
  const member = await getMemberRecord(interaction.guildId, interaction.user.id);
  if (!member) {
    await interaction.editReply('Run `/register` and `/add character` first.');
    return;
  }

  const requestedName = interaction.options.getString('character', true).trim();
  const characters = await getCharacters(member.id);
  const character = characters.find((item) => item.character_name.toLowerCase() === requestedName.toLowerCase());
  if (!character) {
    await interaction.editReply('I couldn’t find that character in your roster.');
    return;
  }

  const level = interaction.options.getInteger('level', true);
  const { error } = await supabase
    .from('discord_characters')
    .update({ level, updated_at: new Date().toISOString() })
    .eq('id', character.id);
  if (error) throw error;
  await interaction.editReply(`Updated **${escapeMarkdown(character.character_name)}** to level ${level}.`);
}

async function handleCharacterAutocomplete(interaction) {
  if (!interaction.guildId) return interaction.respond([]);
  const member = await getMemberRecord(interaction.guildId, interaction.user.id);
  if (!member) return interaction.respond([]);
  const characters = await getCharacters(member.id);
  const typed = interaction.options.getFocused().toLowerCase();
  return interaction.respond(characters
    .filter((character) => character.character_name.toLowerCase().includes(typed))
    .slice(0, 25)
    .map((character) => ({ name: character.character_name.slice(0, 100), value: character.character_name })));
}

async function handleProfile(interaction) {
  if (!requireGuild(interaction)) return;
  await interaction.deferReply();
  const target = interaction.options.getUser('member', true);
  const member = await getMemberRecord(interaction.guildId, target.id);
  if (!member) {
    await interaction.editReply({ content: `${target} hasn’t registered in this server yet.`, allowedMentions: { parse: [] } });
    return;
  }

  const characters = await getCharacters(member.id);
  const embed = new EmbedBuilder()
    .setColor(0x39a86b)
    .setTitle(`${target.username}’s ArcheAge Profile`)
    .setDescription(formatCharacterList(characters));
  await interaction.editReply({ embeds: [embed], allowedMentions: { parse: [] } });
}

async function handleRoster(interaction) {
  if (!requireGuild(interaction)) return;
  await interaction.deferReply();
  const page = interaction.options.getInteger('page') ?? 1;
  const first = (page - 1) * ROSTER_PAGE_SIZE;
  const last = first + ROSTER_PAGE_SIZE - 1;
  const { data: members, count, error } = await supabase
    .from('discord_members')
    .select('id, discord_user_id, discord_username', { count: 'exact' })
    .eq('guild_id', interaction.guildId)
    .order('discord_username', { ascending: true })
    .range(first, last);
  if (error) throw error;
  if (!members?.length) {
    await interaction.editReply(page === 1 ? 'No one has registered in this server yet.' : 'There are no more roster pages.');
    return;
  }

  const { data: characters, error: characterError } = await supabase
    .from('discord_characters')
    .select('member_id, character_name, class_name, level')
    .in('member_id', members.map((member) => member.id))
    .order('character_name', { ascending: true });
  if (characterError) throw characterError;

  const byMember = new Map(members.map((member) => [member.id, []]));
  for (const character of characters ?? []) byMember.get(character.member_id)?.push(character);
  const fields = members.map((member) => {
    const name = member.discord_username || `Discord user ${member.discord_user_id}`;
    const charRows = byMember.get(member.id) ?? [];
    const value = charRows.length
      ? charRows.map((character) => `${escapeMarkdown(character.character_name)} — ${escapeMarkdown(character.class_name)}, Lv. ${character.level}`).join('\n')
      : 'No characters added yet.';
    return { name: name.slice(0, 256), value: value.slice(0, 400), inline: false };
  });

  const total = count ?? members.length;
  const maxPages = Math.max(1, Math.ceil(total / ROSTER_PAGE_SIZE));
  const embed = new EmbedBuilder()
    .setColor(0x39a86b)
    .setTitle('ArcheAge Server Roster')
    .setDescription(`Page ${page} of ${maxPages} · ${total} registered member${total === 1 ? '' : 's'}`)
    .addFields(fields);
  await interaction.editReply({ embeds: [embed], allowedMentions: { parse: [] } });
}

client.once(Events.ClientReady, (readyClient) => {
  console.log(`ArcheAge bot ready as ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isAutocomplete()) {
      if (interaction.commandName === 'add' && interaction.options.getSubcommand() === 'level') {
        await handleCharacterAutocomplete(interaction);
      }
      return;
    }
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'register') await handleRegister(interaction);
    else if (interaction.commandName === 'add' && interaction.options.getSubcommand() === 'character') await handleAddCharacter(interaction);
    else if (interaction.commandName === 'add' && interaction.options.getSubcommand() === 'level') await handleAddLevel(interaction);
    else if (interaction.commandName === 'profile') await handleProfile(interaction);
    else if (interaction.commandName === 'roster') await handleRoster(interaction);
  } catch (error) {
    console.error('Interaction failed:', error?.code ?? error?.name ?? 'unknown_error', error?.message ?? 'No error message');
    const response = { content: 'Something went wrong while saving or loading the roster. Please try again.', ephemeral: true };
    if (interaction.deferred || interaction.replied) await interaction.followUp(response).catch(() => {});
    else await interaction.reply(response).catch(() => {});
  }
});

await client.login(DISCORD_BOT_TOKEN);
