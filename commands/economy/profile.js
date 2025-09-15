// commands/economy/profile.js

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Profile = require('../../models/Profile');
const Bounty = require('../../models/Bounty');
const { BACKPACK_UPGRADES, WEAPON_POWER } = require('../../gameConfig');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription('Show your complete profile in the city.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user whose profile you want to see.')
                .setRequired(false)),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const guildId = interaction.guild.id;

        if (targetUser.bot) {
            return interaction.reply({ content: 'Bots dosen\'t have profiles to show.', ephemeral: true });
        }

        await interaction.deferReply();

        try {
            // Hacemos ambas búsquedas en la base de datos al mismo tiempo para ser más eficientes.
            const [userProfile, currentBounty] = await Promise.all([
                Profile.findOne({ userId: targetUser.id, guildId }),
                Bounty.findOne({ guildId })
            ]);

            if (!userProfile) {
                const noProfileEmbed = new EmbedBuilder()
                    .setColor(0xED4245)
                    .setTitle(`Profile of ${targetUser.username}`)
                    .setDescription('This user hasn\'t started the journey on the city yet.');
                return interaction.editReply({ embeds: [noProfileEmbed] });
            }

            // --- Procesamiento de Datos ---

            // 1. Finanzas
            const wallet = userProfile.wallet || 0;
            const bank = userProfile.bank || 0;
            const totalMoney = wallet + bank;

            // 2. Equipamiento
            const backpackTier = userProfile.backpackTier || 0;
            const backpackInfo = BACKPACK_UPGRADES[backpackTier];
            const arsenal = Array.from(userProfile.arsenal.keys());
            const arsenalText = arsenal.length > 0 ? arsenal.map(w => `• ${w}`).join('\n') : 'None';

            // 3. Actividad Diaria
            const dailyStreak = userProfile.dailyStreak || 0;
            const hasCompletedBounty = currentBounty && userProfile.lastBountyClaim > currentBounty.lastReset;
            const bountyStatus = hasCompletedBounty ? '✅ Complete' : '⏳ Undelivered';

            // 4. Cálculo de Reputación (La mecánica única)
            const moneyRep = Math.floor(totalMoney / 500);
            const equipmentRep = (arsenal.length * 50) + (backpackTier * 25);
            const activityRep = dailyStreak * 10;
            const totalReputation = moneyRep + equipmentRep + activityRep;

            // --- Construcción del Embed ---
            const profileEmbed = new EmbedBuilder()
                .setColor(0x7289DA)
                .setTitle(`Profile of ${targetUser.username}`)
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                .addFields(
                    { name: 'City reputation', value: `**${totalReputation.toLocaleString()}** points` },
                    { name: '─────────────────────────', value: '\u200B' }, // Separador
                    { name: 'Economy', value: `**Wallet:** ${wallet.toLocaleString()}\n**Bank:** ${bank.toLocaleString()}`, inline: true },
                    { name: 'Equipment', value: `**Backpack:** ${backpackInfo.name}\n**Capacity:** ${backpackInfo.capacity} objets`, inline: true },
                    { name: 'Arsenal', value: arsenalText, inline: false },
                    { name: '─────────────────────────', value: '\u200B' }, // Separador
                    { name: '📅 Daily Activity', value: `**Streak:** 🔥 ${dailyStreak} days\n**Today's assignment:** ${bountyStatus}`, inline: false }
                )
                .setTimestamp()
                .setFooter({ text: `User since ${userProfile.createdAt.toLocaleDateString()}` });

            await interaction.editReply({ embeds: [profileEmbed] });

        } catch (error) {
            console.error('Error en /profile:', error);
            await interaction.editReply({ content: 'Hubo un error al obtener el perfil.', ephemeral: true });
        }
    },
};
