import {
  SlashCommandBuilder,
} from 'discord.js';

export const commandDefinitions = [
  new SlashCommandBuilder()
    .setName('register')
    .setDescription('Register your Discord account for the ArcheAge roster.'),

  new SlashCommandBuilder()
    .setName('add')
    .setDescription('Add a character or update one of your character levels.')
    .addSubcommand((subcommand) => subcommand
      .setName('character')
      .setDescription('Add a character to your roster.')
      .addStringOption((option) => option
        .setName('name')
        .setDescription('Your in-game character name.')
        .setRequired(true)
        .setMaxLength(40))
      .addStringOption((option) => option
        .setName('class')
        .setDescription('Your character class.')
        .setRequired(true)
        .setMaxLength(40))
      .addIntegerOption((option) => option
        .setName('level')
        .setDescription('Starting character level (optional).')
        .setMinValue(1)
        .setMaxValue(1000)))
    .addSubcommand((subcommand) => subcommand
      .setName('level')
      .setDescription('Set the level for one of your registered characters.')
      .addStringOption((option) => option
        .setName('character')
        .setDescription('Choose one of your registered characters.')
        .setRequired(true)
        .setAutocomplete(true))
      .addIntegerOption((option) => option
        .setName('level')
        .setDescription('Current character level.')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(1000))),

  new SlashCommandBuilder()
    .setName('profile')
    .setDescription('View a member’s registered ArcheAge characters.')
    .addUserOption((option) => option
      .setName('member')
      .setDescription('The Discord member to look up.')
      .setRequired(true)),

  new SlashCommandBuilder()
    .setName('roster')
    .setDescription('View registered ArcheAge characters in this server.')
    .addIntegerOption((option) => option
      .setName('page')
      .setDescription('Roster page number.')
      .setMinValue(1)),

  new SlashCommandBuilder()
    .setName('view')
    .setDescription('View server member characters and classes.')
    .addSubcommand((subcommand) => subcommand
      .setName('members')
      .setDescription('List registered members, characters, classes, and levels.')
      .addIntegerOption((option) => option
        .setName('page')
        .setDescription('Roster page number.')
        .setMinValue(1))),
]; 

export const commandJson = commandDefinitions.map((command) => command.toJSON());
