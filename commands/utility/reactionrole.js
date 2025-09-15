// commands/utility/reactionrole.js

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const ReactionRole = require('../../models/ReactionRole');
const { EMOJIS } = require('../../gameConfig');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reactionrole')
        .setDescription('Set up and manage reaction role panels in your server.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add a role-emoji pair to a message.')
                .addStringOption(option => option.setName('message_id').setDescription('The ID of the message that will act as the panel.').setRequired(true))
                .addRoleOption(option => option.setName('role').setDescription('The role to be assigned.').setRequired(true))
                .addStringOption(option => option.setName('emoji').setDescription('The emoji that will trigger the role.').setRequired(true))
                .addStringOption(option => option.setName('mode').setDescription('The assignment mode (only for the first role of a panel).').setRequired(false)
                    .addChoices(
                        { name: 'Normal (Add/Remove with reaction)', value: 'normal' },
                        { name: 'Unique (Only one role from the panel at a time)', value: 'unique' },
                        { name: 'Toggle (The reaction disappears, gives/removes role)', value: 'toggle' },
                        { name: 'Verify (One-time role, the reaction disappears)', value: 'verify' }
                    ))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove a role-emoji pair from a panel.')
                .addStringOption(option => option.setName('message_id').setDescription('The ID of the message of the panel.').setRequired(true))
                .addStringOption(option => option.setName('emoji').setDescription('The emoji you want to unlink.').setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('Delete the configuration of a role panel completely.')
                .addStringOption(option => option.setName('message_id').setDescription('The ID of the message of the panel to delete.').setRequired(true))
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const messageId = interaction.options.getString('message_id');
        
        await interaction.deferReply({ ephemeral: true });

        let targetMessage;
        try {
            const channels = await interaction.guild.channels.fetch();
            for (const channel of channels.values()) {
                if (channel.isTextBased()) {
                    targetMessage = await channel.messages.fetch(messageId).catch(() => null);
                    if (targetMessage) break;
                }
            }
            if (!targetMessage) {
                return interaction.editReply('There was no message found with the provided ID in any text channel of this server.');
            }
        } catch (error) {
            return interaction.editReply('The provided message ID is not valid.');
        }

        if (subcommand === 'add') {
            const role = interaction.options.getRole('role');
            const emoji = interaction.options.getString('emoji');
            const mode = interaction.options.getString('mode');

            let customEmoji;
            try {
                await targetMessage.react(emoji);
                const reaction = targetMessage.reactions.cache.find(r => r.emoji.name === emoji || r.emoji.toString() === emoji);
                customEmoji = reaction.emoji.id || reaction.emoji.name;
            } catch (error) {
                return interaction.editReply('The provided emoji is not valid or I do not have access to it.');
            }

            let config = await ReactionRole.findOne({ messageId });
            if (config) {
                if (config.roles.some(r => r.emoji === customEmoji)) {
                    return interaction.editReply(`This emoji is already assigned to a role in this panel.`);
                }
                config.roles.push({ emoji: customEmoji, roleId: role.id });
            } else {
                if (!mode) {
                    return interaction.editReply('This is the first role for this panel. You must specify a `mode` (normal, unique, toggle, or verify).');
                }
                config = new ReactionRole({
                    guildId: interaction.guild.id,
                    channelId: targetMessage.channel.id,
                    messageId: messageId,
                    mode: mode,
                    roles: [{ emoji: customEmoji, roleId: role.id }],
                });
            }
            
            await config.save();

            const successEmbed = new EmbedBuilder()
                .setColor(0x57F287)
                .setTitle(`${EMOJIS.check.text} Role Added to Panel`)
                .setDescription(`The panel has been successfully configured. Now, when a user reacts with ${emoji}, they will receive the role ${role}.`);

            await interaction.editReply({ embeds: [successEmbed] });

        } else if (subcommand === 'remove') {
            const emoji = interaction.options.getString('emoji');
            const config = await ReactionRole.findOne({ messageId });

            if (!config) return interaction.editReply('This message is not configured as a reaction role panel.');

            // --- FIX AQUÍ: Lógica de parseo de emoji mejorada y más robusta ---
            let emojiIdentifier;
            const customEmojiMatch = emoji.match(/<a?:.*:(\d{17,19})>/);
            if (customEmojiMatch) {
                // Si es un emoji personalizado, usamos su ID
                emojiIdentifier = customEmojiMatch[1];
            } else {
                // Si no, asumimos que es un emoji estándar (unicode)
                emojiIdentifier = emoji;
            }

            const initialLength = config.roles.length;
            // Filtramos el array de roles, eliminando el que coincida
            config.roles = config.roles.filter(r => r.emoji !== emojiIdentifier);

            if (config.roles.length === initialLength) {
                return interaction.editReply('This emoji is not assigned to any role in this panel. Please make sure to use the same emoji you configured.');
            }

            await config.save();
            
            // Quitamos la reacción del bot del mensaje
            const reaction = targetMessage.reactions.cache.find(r => (r.emoji.id || r.emoji.name) === emojiIdentifier);
            if (reaction) await reaction.remove();

            const successEmbed = new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle(`${EMOJIS.close.text} Role Removed from Panel`)
                .setDescription(`The emoji ${emoji} has been unlinked from its role in this panel.`);

            await interaction.editReply({ embeds: [successEmbed] });

        } else if (subcommand === 'delete') {
            const deleted = await ReactionRole.findOneAndDelete({ messageId, guildId: interaction.guild.id });
            if (deleted) {
                await targetMessage.reactions.removeAll().catch(console.error);
                return interaction.editReply({ content: 'The configuration of the role panel has been deleted and the reactions cleared.' });
            }
            return interaction.editReply({ content: 'No configuration was found for that message ID.' });
        }
    },
};
