// commands/moderation/lockdown.js

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { sendModLog } = require('../../utils/modlog');
const GuildConfig = require('../../models/GuildConfig');
const { EMOJIS } = require('../../gameConfig');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lockdown')
        .setDescription('Block or unblock the current channel for members.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('A brief reason for the action (will be shown in the logs).')
                .setRequired(false)),

    async execute(interaction) {
        const channel = interaction.channel;
        const reason = interaction.options.getString('reason') || 'No reason provided.';
        const everyoneRole = interaction.guild.roles.everyone;

        const botPermissions = channel.permissionsFor(interaction.guild.members.me);
        if (!botPermissions.has(PermissionFlagsBits.ManageRoles) || !botPermissions.has(PermissionFlagsBits.ManageMessages)) {
            const embed = new EmbedBuilder()
                .setColor(0xED4245)
                .setDescription(`${EMOJIS.error.text} I do not have the necessary permissions to perform this action. Please ensure I have both \`Manage Roles\` and \`Manage Messages\` permissions in this channel.`);
            await interaction.reply({ embeds: [embed], ephemeral: true });
            return;
        }

        await interaction.deferReply({ ephemeral: true });

        const guildConfig = await GuildConfig.findOneAndUpdate(
            { guildId: interaction.guild.id },
            {},
            { upsert: true, new: true }
        );

        const isLocked = guildConfig.lockedChannels.has(channel.id);
        const action = isLocked ? 'Unlock' : 'Lock';
        const color = isLocked ? 0x57F287 : 0xED4245;

        const confirmationEmbed = new EmbedBuilder()
            .setColor(color)
            .setTitle(`Confirm ${action}`)
            .setDescription(`${EMOJIS.warning.text} You are about to **${action.toLowerCase()}** the channel ${channel}. Are you sure?`)
            .addFields({ name: 'Reason', value: reason });

        const components = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`confirm_${action.toLowerCase()}`).setLabel(`Confirm ${action}`).setEmoji(EMOJIS.check.id).setStyle(isLocked ? ButtonStyle.Success : ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('cancel_action').setLabel('Cancel').setEmoji(EMOJIS.close.id).setStyle(ButtonStyle.Secondary)
        );

        const reply = await interaction.editReply({ embeds: [confirmationEmbed], components: [components] });

        try {
            const confirmation = await reply.awaitMessageComponent({ filter: i => i.user.id === interaction.user.id, time: 60000 });

            if (confirmation.customId === 'cancel_action') {
                const embed = new EmbedBuilder()
                    .setColor(0x57F287)
                    .setDescription(`${EMOJIS.info.text} The ${action.toLowerCase()} operation has been canceled. No action has been taken.`);
                await confirmation.update({ embeds: [embed], components: [] });
                return;
            }

            const embed = new EmbedBuilder()
                .setColor(0xED4245)
                .setDescription(`${EMOJIS.check.text} The ${action.toLowerCase()} operation is being processed...`);
            await confirmation.update({ embeds: [embed], components: [] });

            if (isLocked) {
                // --- IMPROVED UNLOCK LOGIC ---
                const lockMessageId = guildConfig.lockedChannels.get(channel.id);
                if (lockMessageId) {
                    const lockMessage = await channel.messages.fetch(lockMessageId).catch(() => null);
                    if (lockMessage) await lockMessage.delete();
                }

                await channel.permissionOverwrites.edit(everyoneRole, {
                    SendMessages: null,
                    AddReactions: null,
                });

                guildConfig.lockedChannels.delete(channel.id);
                await guildConfig.save();

                const unlockedEmbed = new EmbedBuilder()
                    .setColor(0x57F287)
                    .setTitle(`Lockdown Lifted ${EMOJIS.unlock.text}`)
                    .setDescription('The lockdown has been lifted. Members can now send messages and add reactions in this channel.');

                const unlockMsg = await channel.send({ embeds: [unlockedEmbed] });
                setTimeout(() => unlockMsg.delete().catch(() => {}), 10000);

            } else {
                // --- IMPROVED LOCK LOGIC ---
                await channel.permissionOverwrites.edit(everyoneRole, {
                    SendMessages: false,
                    AddReactions: false,
                });

                const lockedEmbed = new EmbedBuilder()
                    .setColor(0xED4245)
                    .setTitle(`Lockdown Initiated ${EMOJIS.lock.text}`)
                    .setDescription(`${EMOJIS.emergency.text} This channel has been temporarily locked by a moderator. While the channel is locked users cannot send messages or add reactions.\n\n**Moderator:** ${interaction.user.tag}`)
                    .setTimestamp();
                
                const lockMsg = await channel.send({ embeds: [lockedEmbed] });
                
                guildConfig.lockedChannels.set(channel.id, lockMsg.id);
                await guildConfig.save();
            }

            await sendModLog(interaction, {
                action: `Channel ${isLocked ? 'Unlock' : 'Lock'}`,
                color: color,
                moderator: interaction.user,
                channel: channel,
                reason: reason
            });

            await interaction.editReply({ embeds: [new EmbedBuilder().setDescription(`${EMOJIS.check.text} The channel has been ${isLocked ? 'unlocked' : 'locked'} successfully!`).setColor(isLocked ? 0x57F287 : 0xED4245)], components: [] });

        } catch (err) {
            await interaction.editReply({ content: `The action was not confirmed. The operation has expired .`, embeds: [], components: [] });
        }
    },
};
