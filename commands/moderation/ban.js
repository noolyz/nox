// commands/moderation/ban.js

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { sendModLog } = require('../../utils/modlog');
const { EMOJIS } = require('../../gameConfig');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Ban a user from the server.')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addUserOption(option => option.setName('user').setDescription('The user to ban.').setRequired(true))
        .addStringOption(option => option.setName('reason').setDescription('The reason for the ban.').setRequired(true))
        .addIntegerOption(option =>
            option.setName('delete_messages')
                .setDescription('The message history of the user to delete.')
                .setRequired(true)
                .addChoices(
                    { name: 'Don\'t delete any', value: 0 },
                    { name: 'Previous 24 hours', value: 1 },
                    { name: 'Previous 7 days', value: 7 }
                )),

    async execute(interaction) {
        const target = interaction.options.getMember('user');
        const reason = interaction.options.getString('reason');
        const deleteDays = interaction.options.getInteger('delete_messages');
        const moderator = interaction.member;

        if (!target) {
            const embed = new EmbedBuilder().setColor(0xED4245).setDescription(`${EMOJIS.error.text} I could not find that user in the server.`);
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
        if (target.id === interaction.user.id) {
            const embed = new EmbedBuilder().setColor(0xED4245).setDescription(`${EMOJIS.error.text} You cannot ban yourself.`);
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
        if (target.permissions.has(PermissionFlagsBits.Administrator)) {
            const embed = new EmbedBuilder().setColor(0xED4245).setDescription(`${EMOJIS.error.text} You cannot ban an administrator.`);
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
        if (moderator.roles.highest.position <= target.roles.highest.position) {
            const embed = new EmbedBuilder().setColor(0xED4245).setDescription(`${EMOJIS.error.text} You cannot ban a member with a role equal to or higher than yours.`);
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
        if (!target.bannable) {
            const embed = new EmbedBuilder().setColor(0xED4245).setDescription(`${EMOJIS.error.text} I do not have permission to ban this user. Please check the role hierarchy.`);
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        const deleteDaysText = deleteDays === 0 ? 'None' : `Previous ${deleteDays} day(s)`;

        const confirmationEmbed = new EmbedBuilder()
            .setColor(0xFEE75C)
            .setTitle(`Ban Verdict Confirmation ${EMOJIS.justice.text}`)
            .setDescription(`You are about to permanently ban **${target.user.tag}**.\n${EMOJIS.error.text} **\`This action is irreversible\`**\n\nConfirm the sentence to proceed.`)
            .setThumbnail(target.user.displayAvatarURL())
            .addFields(
                { name: `Provided Reason`, value: reason },
                { name: `Message Purge`, value: `**${deleteDaysText}**` }
            );

        const components = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('confirm_ban').setLabel('Confirm Ban').setEmoji(EMOJIS.check.id).setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('cancel_ban').setLabel('Cancel').setEmoji(EMOJIS.close.id).setStyle(ButtonStyle.Secondary)
        );

        const reply = await interaction.editReply({ embeds: [confirmationEmbed], components: [components] });
        
        try {
            const confirmation = await reply.awaitMessageComponent({ filter: i => i.user.id === interaction.user.id, time: 60000 });
            
            if (confirmation.customId === 'cancel_ban') {
                const embed = new EmbedBuilder()
                    .setColor(0x57F287)
                    .setDescription(`${EMOJIS.info.text} The ban has been canceled. No action has been taken.`);
                await confirmation.update({ embeds: [embed], components: [] });
                return;
            }

            // --- FIX IS HERE: Acknowledge the confirmation FIRST ---
            await confirmation.update({ content: 'Processing the ban...', embeds: [], components: [] });

            const dmEmbed = new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle(`You have been permanently banned from ${interaction.guild.name}`)
                .addFields({ name: 'Reason', value: reason })
                .setDescription('Your access to this server has been permanently revoked.');

            await target.send({ embeds: [dmEmbed] }).catch(() => console.log(`Could not send DM to ${target.user.tag}.`));

            // --- FIX IS HERE: Correct conversion from days to seconds ---
            const deleteMessageSeconds = deleteDays * 24 * 60 * 60;
            await target.ban({ deleteMessageSeconds, reason: reason });

            await sendModLog(interaction, {
                action: 'Ban (Permanent)',
                color: 0x992D22,
                moderator: interaction.user,
                target: target.user,
                reason: `${reason}\n**Messages deleted:** ${deleteDaysText}`
            });

            // Use followUp because the interaction from the button has been updated
            await interaction.followUp({ content: `User **${target.user.tag}** has been successfully banned.`, ephemeral: true });

        } catch (err) {
            console.error('Error during ban confirmation:', err);
            const errorEmbed = new EmbedBuilder()
                .setColor(0xED4245)
                .setDescription('The action was not confirmed in time. The ban verdict has expired.');
            await interaction.editReply({ embeds: [errorEmbed], components: [] });
        }
    },
};
