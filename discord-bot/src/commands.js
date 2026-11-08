import { SlashCommandBuilder } from 'discord.js';

export const commandDefinitions = [
  new SlashCommandBuilder()
    .setName('add')
    .setDescription('Add a character or update its details.')
    .addSubcommand((subcommand) => subcommand
      .setName('character')
      .setDescription('Add a character name to your roster.')
      .addStringOption((option) => option
        .setName('name')
        .setDescription('Your in-game character name.')
        .setRequired(true)
        .setMaxLength(40)))
    .addSubcommand((subcommand) => subcommand
      .setName('details')
      .setDescription('Set or update class, level, and playstyle.')
      .addStringOption((option) => option
        .setName('character')
        .setDescription('Choose one of your characters.')
        .setRequired(true)
        .setAutocomplete(true))
      .addStringOption((option) => option
        .setName('class')
        .setDescription('Choose your character class.')
        .addChoices(
          { name: 'Ranger', value: 'Ranger' },
          { name: 'Berserker', value: 'Berserker' },
          { name: 'Warrior', value: 'Warrior' },
          { name: 'Mage', value: 'Mage' },
        ))
      .addIntegerOption((option) => option
        .setName('level')
        .setDescription('Current character level.')
        .setMinValue(1)
        .setMaxValue(1000))
      .addStringOption((option) => option
        .setName('playstyle')
        .setDescription('Choose PvE, PvP, or PvX.')
        .addChoices(
          { name: 'PvE', value: 'pve' },
          { name: 'PvP', value: 'pvp' },
          { name: 'PvX', value: 'pvx' },
        ))),

  new SlashCommandBuilder()
    .setName('view')
    .setDescription('View a member’s profile or browse the roster.')
    .addSubcommand((subcommand) => subcommand
      .setName('member')
      .setDescription('View a member’s characters.')
      .addUserOption((option) => option
        .setName('member')
        .setDescription('Choose the member to view.')
        .setRequired(true)))
    .addSubcommand((subcommand) => subcommand
      .setName('roster')
      .setDescription('Browse all registered characters.')
      .addIntegerOption((option) => option
        .setName('page')
        .setDescription('Roster page.')
        .setMinValue(1))),

  new SlashCommandBuilder()
    .setName('event')
    .setDescription('View event schedules in your local time.')
    .addStringOption((option) => option
      .setName('event')
      .setDescription('Choose an event schedule.')
      .setRequired(true)
      .addChoices(
        { name: 'Crimson Rift', value: 'crimson_rift' },
        { name: 'Burial Nightmare', value: 'burial_nightmare' },
        { name: 'Daily Reset', value: 'daily_reset' },
      )),
];

export const commandJson = commandDefinitions.map((command) => command.toJSON());
