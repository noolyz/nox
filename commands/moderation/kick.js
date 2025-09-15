// commands/moderation/kick.js

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { sendModLog } = require('../../utils/modlog');
const { EMOJIS } = require('../../gameConfig');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Kick a user from the server.')
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
        .addUserOption(option => option.setName('user').setDescription('The user to kick.').setRequired(true))
        .addStringOption(option => option.setName('reason').setDescription('The reason for the kick.').setRequired(true)),

    async execute(interaction) {
        const target = interaction.options.getMember('user');
        const reason = interaction.options.getString('reason');
        const moderator = interaction.member;

        // --- Validaciones Previas ---
        if (!target) {
            const embed = new EmbedBuilder().setColor(0xED4245).setDescription(`${EMOJIS.error.text} I could not find that user in the server.`);
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
        if (target.id === interaction.user.id) {
            const embed = new EmbedBuilder().setColor(0xED4245).setDescription(`${EMOJIS.error.text} You cannot kick yourself.`);
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
        if (target.permissions.has(PermissionFlagsBits.Administrator)) {
            const embed = new EmbedBuilder().setColor(0xED4245).setDescription(`${EMOJIS.error.text} You cannot kick an administrator.`);
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
        if (moderator.roles.highest.position <= target.roles.highest.position) {
            const embed = new EmbedBuilder().setColor(0xED4245).setDescription(`${EMOJIS.error.text} You cannot kick a member with a role equal to or higher than yours.`);
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
        if (!target.kickable) {
            const embed = new EmbedBuilder().setColor(0xED4245).setDescription(`${EMOJIS.error.text} I do not have permission to kick this user. Please check the role hierarchy.`);
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        const confirmationEmbed = new EmbedBuilder()
            .setColor(0xFEE75C)
            .setTitle(`Kick Confirmation ${EMOJIS.justice.text}`)
            .setDescription(`You are about to kick **${target.user.tag}**. Are you sure you want to proceed?`)
            .setThumbnail(target.user.displayAvatarURL())
            .addFields(
                { name: `${EMOJIS.scroll.text} Provided Reason`, value: reason }
            );

        const components = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('confirm_kick').setLabel('Confirm Kick').setEmoji(EMOJIS.check.id).setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('cancel_kick').setLabel('Cancel').setEmoji(EMOJIS.close.id).setStyle(ButtonStyle.Secondary)
        );

        const reply = await interaction.editReply({ embeds: [confirmationEmbed], components: [components] });
        
        try {
            const confirmation = await reply.awaitMessageComponent({ filter: i => i.user.id === interaction.user.id, time: 60000 });
            
            if (confirmation.customId === 'cancel_kick') {
                await confirmation.update({ content: `${EMOJIS.check.text} The kick has been canceled.`, embeds: [], components: [] });
                return;
            }

            // Notify the kicked user via DM
            const dmEmbed = new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle(`You have been kicked from ${interaction.guild.name}`)
                .addFields({ name: 'Reason', value: reason })
                .setDescription(`${EMOJIS.info.text} You can rejoin using a new invite if one is provided.`);

            await target.send({ embeds: [dmEmbed] }).catch(() => console.log(`Could not send DM to ${target.user.tag}.`));

            // Kick the user
            await target.kick(reason);

            // Send moderation log
            await sendModLog(interaction, {
                action: 'Kick',
                color: 0xE67E22,
                moderator: interaction.user,
                target: target.user,
                reason: reason
            });

            await confirmation.update({ content: `${EMOJIS.check.text} User **${target.user.tag}** has been successfully kicked.`, embeds: [], components: [] });

        } catch (err) {
            await interaction.editReply({ content: `${EMOJIS.warning.text} The action was not confirmed in time. The kick verdict has expired.`, embeds: [], components: [] });
        }
    },
};
