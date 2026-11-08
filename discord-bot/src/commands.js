import { SlashCommandBuilder } from 'discord.js';

export const commandDefinitions = [
  new SlashCommandBuilder().setName('add').setDescription('Add a character or update its details.')
    .addSubcommand((subcommand) => subcommand.setName('character').setDescription('Add a character name to your roster.')
      .addStringOption((option) => option.setName('name').setDescription('Your in-game character name.').setRequired(true).setMaxLength(40)))
    .addSubcommand((subcommand) => subcommand.setName('details').setDescription('Set or update class, level, and playstyle.')
      .addStringOption((option) => option.setName('character').setDescription('Choose one of your characters.').setRequired(true).setAutocomplete(true))
      .addStringOption((option) => option.setName('class').setDescription('Your character class.').setMaxLength(40))
      .addIntegerOption((option) => option.setName('level').setDescription('Your character level.').setMinValue(1).setMaxValue(1000))
      .addStringOption((option) => option.setName('playstyle').setDescription('PvE, PvP, or PvX.')
        .addChoices({ name: 'PvE', value: 'pve' }, { name: 'PvP', value: 'pvp' }, { name: 'PvX', value: 'pvx' }))),
  new SlashCommandBuilder().setName('view').setDescription('View the ArcheAge roster or one member’s profile.')
    .addUserOption((option) => option.setName('member').setDescription('Choose a member; leave blank to see the roster.'))
    .addIntegerOption((option) => option.setName('page').setDescription('Roster page (when viewing the full roster).').setMinValue(1)),
  new SlashCommandBuilder().setName('event').setDescription('View event schedules in your local time.')
    .addStringOption((option) => option.setName('event').setDescription('Choose an event schedule.').setRequired(true)
      .addChoices({ name: 'Crimson Rift', value: 'crimson_rift' }, { name: 'Burial Nightmare', value: 'burial_nightmare' }, { name: 'Daily Reset', value: 'daily_reset' })),
];
export const commandJson = commandDefinitions.map((command) => command.toJSON());
