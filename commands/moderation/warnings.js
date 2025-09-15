// commands/moderation/warnings.js

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const Profile = require('../../models/Profile');
const { sendModLog } = require('../../utils/modlog');
const { EMOJIS } = require('../../gameConfig');

const WARNINGS_PER_PAGE = 5;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warnings')
        .setDescription('Shows and manages the warning history of a user.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user whose record you want to view.')
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const targetUser = interaction.options.getUser('user');
        const guildId = interaction.guild.id;

        let userProfile = await Profile.findOne({ userId: targetUser.id, guildId });

        if (!userProfile || !userProfile.warnings || userProfile.warnings.length === 0) {
            const noWarningsEmbed = new EmbedBuilder()
                .setColor(0x57F287)
                .setTitle(`${targetUser.username}'s Record`)
                .setDescription('This user has a clean record. No warnings have been issued.');
            return interaction.editReply({ embeds: [noWarningsEmbed] });
        }

        let warnings = [...userProfile.warnings].reverse();
        const totalPages = Math.ceil(warnings.length / WARNINGS_PER_PAGE);
        let currentPage = 0;
        let currentView = 'viewing';
        let selectedWarningId = null;

        const generateUI = () => {
            let embed, components = [];
            
            if (currentView === 'viewing') {
                const start = currentPage * WARNINGS_PER_PAGE;
                const end = start + WARNINGS_PER_PAGE;
                const pageWarnings = warnings.slice(start, end);

                embed = new EmbedBuilder()
                    .setColor(0xE67E22)
                    .setTitle(`${targetUser.username}'s Record`)
                    .setFooter({ text: `Page ${currentPage + 1} of ${totalPages} | Total Warnings: ${warnings.length}` });

                pageWarnings.forEach((warn, index) => {
                    const timestamp = Math.floor(warn.date.getTime() / 1000);
                    embed.addFields({
                        name: `Warning #${warnings.length - (start + index)} (ID: ${warn._id.toString().slice(-5)})`,
                        value: `${EMOJIS.scroll.text} **Reason:** ${warn.reason}\n**${EMOJIS.profile.text} Moderator:** <@${warn.moderatorId}>\n${EMOJIS.calendar.text} **Date:** <t:${timestamp}:F>`,
                        inline: false,
                    });
                });
                
                const navButtons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('prev_page').setLabel('prev').setEmoji(EMOJIS.previous.id).setStyle(ButtonStyle.Primary).setDisabled(currentPage === 0),
                    new ButtonBuilder().setCustomId('next_page').setLabel('next').setEmoji(EMOJIS.next.id).setStyle(ButtonStyle.Primary).setDisabled(currentPage >= totalPages - 1)
                );
                const manageButton = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('manage_warns').setLabel('manage').setEmoji(EMOJIS.settings.id).setStyle(ButtonStyle.Danger)
                );
                components = [navButtons, manageButton];

            } else if (currentView === 'selecting') {
                embed = new EmbedBuilder()
                    .setColor(0x3498DB)
                    .setTitle(`Select Warning to Remove`)
                    .setDescription('Choose a warning from the dropdown menu to proceed with its removal.');

                const menu = new StringSelectMenuBuilder()
                    .setCustomId('select_warning_to_remove')
                    .setPlaceholder('Choose a warning...')
                    .addOptions(warnings.slice(0, 25).map((warn, index) => ({
                        label: `Warning #${warnings.length - index} - ${warn.reason.substring(0, 50)}`,
                        description: `Issued on ${warn.date.toLocaleDateString()}`,
                        value: warn._id.toString(),
                    })));
                
                components.push(new ActionRowBuilder().addComponents(menu));
                components.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('back_to_view').setLabel('Back').setEmoji(EMOJIS.home.id).setStyle(ButtonStyle.Secondary)));
            }
            
            return { embeds: [embed], components };
        };

        const reply = await interaction.editReply(generateUI());
        const collector = reply.createMessageComponentCollector({ filter: i => i.user.id === interaction.user.id, time: 180000 });

        collector.on('collect', async i => {
            // FIX: La lógica de deferUpdate se maneja individualmente por tipo de interacción.
            if (i.isButton()) {
                await i.deferUpdate();
                if (i.customId === 'prev_page') currentPage--;
                if (i.customId === 'next_page') currentPage++;
                if (i.customId === 'manage_warns') currentView = 'selecting';
                if (i.customId === 'back_to_view') currentView = 'viewing';
                await interaction.editReply(generateUI());
            }

            if (i.isStringSelectMenu() && i.customId === 'select_warning_to_remove') {
                selectedWarningId = i.values[0];
                const warningToRemove = warnings.find(w => w._id.toString() === selectedWarningId);
                
                const modal = new ModalBuilder()
                    .setCustomId(`remove_warn_modal_${i.id}`)
                    .setTitle(`Confirm Warning Removal`);
                const reasonInput = new TextInputBuilder()
                    .setCustomId('removal_reason')
                    .setLabel(`Reason for removing the warning (ID: ${selectedWarningId.slice(-5)})`)
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true)
                    .setPlaceholder(`e.g: "The user has shown improvement."`);
                
                modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
                // showModal es una respuesta en sí misma, no necesita deferUpdate.
                await i.showModal(modal);

                try {
                    const modalSubmit = await i.awaitModalSubmit({ filter: mi => mi.user.id === i.user.id && mi.customId === `remove_warn_modal_${i.id}`, time: 120000 });
                    const removalReason = modalSubmit.fields.getTextInputValue('removal_reason');

                    await Profile.updateOne(
                        { userId: targetUser.id, guildId },
                        { $pull: { warnings: { _id: selectedWarningId } } }
                    );

                    await sendModLog(interaction, {
                        action: 'Warning Removed',
                        color: 0x2ECC71,
                        moderator: interaction.user,
                        target: targetUser,
                        reason: `${EMOJIS.warning.text} **Original Warning:** "${warningToRemove.reason}"\n${EMOJIS.scroll.text} **Removal Reason:** ${removalReason}`
                    });

                    const successEmbed = new EmbedBuilder()
                        .setColor(0x57F287)
                        .setDescription(`${EMOJIS.check.text} The warning has been successfully removed from **${targetUser.tag}**'s record.`);
                    await modalSubmit.reply({ embeds: [successEmbed], ephemeral: true });
                    collector.stop();

                    const updatedProfile = await Profile.findOne({ userId: targetUser.id, guildId });
                    if (!updatedProfile || updatedProfile.warnings.length === 0) {
                         const noWarningsEmbed = new EmbedBuilder().setColor(0x57F287).setTitle(`${EMOJIS.profile.text} Profile of ${targetUser.username}`).setDescription('This user has a clean record.');
                         await interaction.editReply({ embeds: [noWarningsEmbed], components: [] });
                    } else {
                        warnings = [...updatedProfile.warnings].reverse();
                        currentView = 'viewing';
                        await interaction.editReply(generateUI());
                    }

                } catch (err) {
                    // El usuario no envió el modal
                }
            }
        });

        collector.on('end', (collected, reason) => {
            if (reason === 'time') {
                interaction.editReply({ content: 'The management session has expired.', components: [] }).catch(() => {});
            }
        });
    },
};