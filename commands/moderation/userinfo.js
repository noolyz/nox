// commands/moderation/userinfo.js

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const Profile = require('../../models/Profile');
const { EMOJIS } = require('../../gameConfig');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('userinfo')
        .setDescription('Shows detailed information about a user.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages) // Requires moderator permissions
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user you want to get information about.')
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const targetUser = interaction.options.getUser('user');
        const targetMember = interaction.options.getMember('user');
        const guildId = interaction.guild.id;

        if (!targetMember) {
            const embed = new EmbedBuilder()
                .setColor(0xED4245)
                .setDescription(`${EMOJIS.error.text} The specified user is no longer a member of this server.`);
            return interaction.editReply({ embeds: [embed] });
        }

        const userProfile = await Profile.findOne({ userId: targetUser.id, guildId }).lean();

        // --- Procesamiento de Datos ---

        // 1. Información de Discord
        const joinedAt = Math.floor(targetMember.joinedTimestamp / 1000);
        const createdAt = Math.floor(targetUser.createdTimestamp / 1000);
        const roles = targetMember.roles.cache
            .filter(role => role.id !== guildId)
            .map(role => role.toString())
            .join(', ');

        // 2. Información Económica (si existe)
        let reputation = 0;
        let totalWealth = 0;
        if (userProfile) {
            totalWealth = (userProfile.wallet || 0) + (userProfile.bank || 0);
            const moneyRep = Math.floor(totalWealth / 500);
            const equipmentRep = ((userProfile.arsenal?.size || 0) * 50) + ((userProfile.backpackTier || 0) * 25);
            const activityRep = (userProfile.dailyStreak || 0) * 10;
            reputation = moneyRep + equipmentRep + activityRep;
        }

        // 3. Información de Moderación (si existe)
        const warningCount = userProfile?.warnings?.length || 0;

        // --- Construcción del Dossier ---
        const infoEmbed = new EmbedBuilder()
            .setColor(targetMember.displayHexColor || 0x5865F2)
            .setAuthor({ name: targetUser.tag, iconURL: targetUser.displayAvatarURL() })
            .setThumbnail(targetUser.displayAvatarURL())
            .setTitle(`${targetUser.username}'s document`)
            .addFields(
                { name: `${EMOJIS.profile.text} General Information`, value: `**ID:** \`${targetUser.id}\`\n**Nickname:** ${targetMember.nickname || 'None'}` },
                { name: `${EMOJIS.calendar.text} Key Dates`, value: `**Joined Discord:** <t:${createdAt}:F>\n**Joined Server:** <t:${joinedAt}:F>` },
                { name: `${EMOJIS.bookmark.text} Roles (${targetMember.roles.cache.size - 1})`, value: roles || 'No roles' },
                { name: '─────────────────────────', value: '\u200B' },
                { name: `${EMOJIS.city.text} City Status`, value: `**Reputation:** ${reputation.toLocaleString()} points\n**Total Wealth:** ${totalWealth.toLocaleString()} coins`, inline: true },
                { name: `${EMOJIS.justice.text} Moderation Record`, value: `**Warnings:** ${warningCount}`, inline: true }
            )
            .setTimestamp()
            .setFooter({ text: `Requested by ${interaction.user.tag}` });

        await interaction.editReply({ embeds: [infoEmbed] });
    },
};
