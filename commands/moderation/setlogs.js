// commands/moderation/setlogs.js

const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const GuildConfig = require('../../models/GuildConfig');
const { EMOJIS } = require('../../gameConfig');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setlogs')
        .setDescription('Set the logs channel for moderation actions. Only administrators can use this command.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) // Solo administradores
        .addSubcommand(subcommand =>
            subcommand
                .setName('set')
                .setDescription('Set the channel where logs will be sent.')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('The channel where logs will be sent.')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('disable')
                .setDescription('Disable moderation logs.')),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        // FIX: Añadimos un try-catch para manejar el caso en que no se proporciona un subcomando.
        // Esto previene el crash y guía al usuario sobre la posible causa.
        let subcommand;
        try {
            subcommand = interaction.options.getSubcommand();
        } catch (error) {
            console.error(error);
            const errorEmbed = new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle(`${EMOJIS.error.text} Error`)
                .setDescription(`${EMOJIS.info.text} There was no subcommand provided (\`set\` or \`disable\`).\n\n**Probable cause:** The bot commands may not be up to date in this server. Please ask an administrator to re-register the commands.`);
            return interaction.editReply({ embeds: [errorEmbed] });
        }

        const guildId = interaction.guild.id;

        if (subcommand === 'set') {
            const logChannel = interaction.options.getChannel('channel');
            
            try {
                const config = await GuildConfig.findOne({ guildId });

                if (config && config.modLogChannel === logChannel.id) {
                    const alreadySetEmbed = new EmbedBuilder()
                        .setColor(0xFEE75C)
                        .setTitle(`${EMOJIS.warning.text} Channel Already Set`)
                        .setDescription(`The channel ${logChannel} is already set as the log channel. No changes were made.`);
                    return interaction.editReply({ embeds: [alreadySetEmbed] });
                }

                await GuildConfig.findOneAndUpdate(
                    { guildId },
                    { modLogChannel: logChannel.id },
                    { upsert: true, new: true }
                );

                const successEmbed = new EmbedBuilder()
                    .setColor(0x57F287)
                    .setTitle(`${EMOJIS.check.text} Logs Channel Set`)
                    .setDescription(`Perfect. From now on, all moderation logs will be sent to ${logChannel}.`);
                await interaction.editReply({ embeds: [successEmbed] });

            } catch (error) {
                console.error('There was an error setting the log channel:', error);
                await interaction.editReply({ content: 'There was an error trying to save the configuration.' });
            }
        } else if (subcommand === 'disable') {
            try {
                const config = await GuildConfig.findOne({ guildId });

                if (!config || !config.modLogChannel) {
                    const notSetEmbed = new EmbedBuilder()
                        .setColor(0xFEE75C)
                        .setTitle(`${EMOJIS.warning.text} Logs already disabled`)
                        .setDescription('The moderation log system was not enabled. No changes were made.');
                    return interaction.editReply({ embeds: [notSetEmbed] });
                }

                config.modLogChannel = null;
                await config.save();

                const disabledEmbed = new EmbedBuilder()
                    .setColor(0xED4245)
                    .setTitle(`${EMOJIS.check.text} Logs Disabled`)
                    .setDescription('The moderation log system has been disabled. No more logs will be sent until a new channel is configured.');
                await interaction.editReply({ embeds: [disabledEmbed] });

            } catch (error) {
                console.error('Error disabling logs:', error);
                await interaction.editReply({ content: 'There was an error trying to update the configuration.' });
            }
        }
    },
};
