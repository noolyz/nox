// commands/moderation/clear.js

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { sendModLog } = require('../../utils/modlog');
const { EMOJIS } = require('../../gameConfig');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('purge')
        .setDescription('Purge messages in the current channel.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addIntegerOption(option =>
            option.setName('quantity')
                .setDescription('The number of messages to delete (between 1 and 100).')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100))
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Filter to delete only messages from this user.')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('filter')
                .setDescription('Apply a special filter to the deletion.')
                .setRequired(false)
                .addChoices(
                    { name: 'Only bots', value: 'bots' },
                    { name: 'Only humans', value: 'humans' },
                    { name: 'With links', value: 'links' },
                    { name: 'With files', value: 'files' }
                )),

    async execute(interaction) {
        const amount = interaction.options.getInteger('quantity');
        const targetUser = interaction.options.getUser('user');
        const filterType = interaction.options.getString('filter');
        const channel = interaction.channel;

        await interaction.deferReply({ ephemeral: true });

        // --- Obtener y Filtrar Mensajes ---
        const messages = await channel.messages.fetch({ limit: amount });
        let filteredMessages = messages;

        let filterDescription = 'None';

        if (targetUser) {
            filteredMessages = filteredMessages.filter(m => m.author.id === targetUser.id);
            filterDescription = `User: ${targetUser.tag}`;
        }

        if (filterType) {
            switch (filterType) {
                case 'bots':
                    filteredMessages = filteredMessages.filter(m => m.author.bot);
                    filterDescription = 'Only Bots';
                    break;
                case 'humans':
                    filteredMessages = filteredMessages.filter(m => !m.author.bot);
                    filterDescription = 'Only Humans';
                    break;
                case 'links':
                    filteredMessages = filteredMessages.filter(m => /https?:\/\/[^\s]*/.test(m.content));
                    filterDescription = 'With Links';
                    break;
                case 'files':
                    filteredMessages = filteredMessages.filter(m => m.attachments.size > 0);
                    filterDescription = 'With Files';
                    break;
            }
        }

        const messagesToDelete = filteredMessages.size;

        if (messagesToDelete === 0) {
            return interaction.editReply({ content: 'No messages matching the selected filters were found.' });
        }

        // --- Tactical Confirmation Panel ---
        const confirmationEmbed = new EmbedBuilder()
            .setColor(0xFEE75C)
            .setTitle('Purge panel')
            .setDescription(`${EMOJIS.emergency.text} You are about to permanently delete **${messagesToDelete}** message(s). This action cannot be undone.`)
            .addFields(
                { name: `${EMOJIS.message.text} Channel`, value: `${channel}`, inline: true },
                { name: `${EMOJIS.info.text} Amount`, value: `${messagesToDelete}`, inline: true },
                { name: `${EMOJIS.pen.text} Applied Filter`, value: filterDescription, inline: true }
            );

        const components = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('confirm_clear').setLabel('Confirm Purge').setEmoji(EMOJIS.check.id).setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('cancel_clear').setLabel('Cancel').setEmoji(EMOJIS.close.id).setStyle(ButtonStyle.Secondary)
        );

        const reply = await interaction.editReply({ embeds: [confirmationEmbed], components: [components] });

        try {
            const confirmation = await reply.awaitMessageComponent({ filter: i => i.user.id === interaction.user.id, time: 60000 });

            if (confirmation.customId === 'cancel_clear') {
                const embed = new EmbedBuilder()
                    .setColor(0x57F287)
                    .setDescription(`${EMOJIS.info.text} The purge operation has been canceled. No action has been taken.`);
                await confirmation.update({ embeds: [embed], components: [] });
                return;
            }

            // --- Ejecución de la Purga ---
            const embed = new EmbedBuilder()
                .setColor(0xED4245)
                .setDescription(`${EMOJIS.info.text} The purge operation is being processed...`);
            await confirmation.update({ embeds: [embed], components: [] });
            const deletedMessages = await channel.bulkDelete(filteredMessages, true);

            // --- Log y Confirmación Final ---
            // --- CHANGE HERE: We send the correct information to the log ---
            await sendModLog(interaction, {
                action: 'Message Purge',
                color: 0x3498DB,
                moderator: interaction.user,
                channel: channel,
                details: `**Amount:** ${deletedMessages.size}\n**Filter:** ${filterDescription}`
            });

            const finalReply = await channel.send({ content: `${EMOJIS.check.text} **${deletedMessages.size}** message(s) have been deleted by a moderator.` });
            setTimeout(() => finalReply.delete().catch(() => {}), 5000);

            const confirmationEmbed = new EmbedBuilder()
                .setColor(0x57F287)
                .setDescription(`${EMOJIS.info.text} The purge operation has been completed successfully.`);
            await interaction.editReply({ embeds: [confirmationEmbed], components: [] });

        } catch (err) {
            await interaction.editReply({ content: 'The action was not confirmed. The operation has timed out.', embeds: [], components: [] });
        }
    },
};
