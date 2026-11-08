import { SlashCommandBuilder } from 'discord.js';

export const commandDefinitions = [
  new SlashCommandBuilder().setName('register').setDescription('Register your Discord account for the ArcheAge roster.'),
  new SlashCommandBuilder().setName('add').setDescription('Add a character or update its details.')
    .addSubcommand((subcommand) => subcommand.setName('character').setDescription('Add a character name to your roster.')
      .addStringOption((option) => option.setName('name').setDescription('Your in-game character name.').setRequired(true).setMaxLength(40)))
    .addSubcommand((subcommand) => subcommand.setName('details').setDescription('Set or update a character’s class, level, and playstyle.')
      .addStringOption((option) => option.setName('character').setDescription('Choose one of your registered characters.').setRequired(true).setAutocomplete(true))
      .addStringOption((option) => option.setName('class').setDescription('Character class (required the first time).').setMaxLength(40))
      .addIntegerOption((option) => option.setName('level').setDescription('Current character level (required the first time).').setMinValue(1).setMaxValue(1000))
      .addStringOption((option) => option.setName('playstyle').setDescription('Choose PvP or PvE (required the first time).')
        .addChoices({ name: 'PvP', value: 'pvp' }, { name: 'PvE', value: 'pve' }))),
  new SlashCommandBuilder().setName('profile').setDescription('View a member’s registered ArcheAge characters.')
    .addUserOption((option) => option.setName('member').setDescription('The Discord member to look up.').setRequired(true)),
  new SlashCommandBuilder().setName('roster').setDescription('View registered ArcheAge characters in this server.')
    .addIntegerOption((option) => option.setName('page').setDescription('Roster page number.').setMinValue(1)),
  new SlashCommandBuilder().setName('view').setDescription('View server member characters and classes.')
    .addSubcommand((subcommand) => subcommand.setName('members').setDescription('List registered members, characters, classes, levels, and playstyles.')
      .addIntegerOption((option) => option.setName('page').setDescription('Roster page number.').setMinValue(1))),
  new SlashCommandBuilder().setName('event').setDescription('View event schedules in your local time.')
    .addStringOption((option) => option.setName('event').setDescription('Choose an event schedule.').setRequired(true)
      .addChoices({ name: 'Crimson Rift', value: 'crimson_rift' }, { name: 'Burial Nightmare', value: 'burial_nightmare' }, { name: 'Daily Reset', value: 'daily_reset' })),
];
export const commandJson = commandDefinitions.map((command) => command.toJSON());
