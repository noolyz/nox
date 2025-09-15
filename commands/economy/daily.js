// commands/economy/daily.js

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Profile = require('../../models/Profile');
const { EMOJIS } = require('../../gameConfig');

// --- CONFIGURACIÓN ---
const DAILY_COOLDOWN = 10 * 1000; // 10 segundos para pruebas // 22 horas para ser flexible
const MAX_STREAK_DAYS = 7;
const BASE_REWARD = 500;
const STREAK_BONUS_PER_DAY = 100;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily')
        .setDescription('Claim your dialy reward!'),

    async execute(interaction) {
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;

        await interaction.deferReply();

        try {
            let userProfile = await Profile.findOne({ userId, guildId });
            if (!userProfile) {
                userProfile = await Profile.create({ userId, guildId });
            }

            const lastDailyTimestamp = userProfile.lastDaily?.getTime() || 0;
            const currentTime = Date.now();
            const timeDifference = currentTime - lastDailyTimestamp;

            // --- Lógica de Cooldown ---
            if (timeDifference < DAILY_COOLDOWN) {
                const remainingTime = DAILY_COOLDOWN - timeDifference;
                const hours = Math.floor(remainingTime / (1000 * 60 * 60));
                const minutes = Math.floor((remainingTime % (1000 * 60 * 60)) / (1000 * 60));
                return interaction.editReply(`You already claimed your reward. Come again in **${hours}h & ${minutes}m**.`);
            }

            // --- Lógica de Racha (Streak) ---
            let currentStreak = userProfile.dailyStreak || 0;
            // Si el tiempo pasado es menor que el doble del cooldown, la racha continúa.
            if (timeDifference < DAILY_COOLDOWN * 2) {
                currentStreak++;
            } else {
                // Si pasó demasiado tiempo, la racha se reinicia a 1.
                currentStreak = 1;
            }
            
            // La racha no puede superar el máximo establecido.
            if (currentStreak > MAX_STREAK_DAYS) {
                currentStreak = MAX_STREAK_DAYS;
            }

            // --- Cálculo de la Recompensa ---
            const streakBonus = (currentStreak - 1) * STREAK_BONUS_PER_DAY;
            const totalReward = BASE_REWARD + streakBonus;

            // Actualizar el perfil del usuario
            userProfile.wallet += totalReward;
            userProfile.lastDaily = new Date();
            userProfile.dailyStreak = currentStreak;
            await userProfile.save();

            // --- Mensaje de Respuesta ---
            const embed = new EmbedBuilder()
                .setColor(0xFFD700) // Color dorado
                .setTitle('Daily reward claimed')
                .setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL() })
                .setDescription(`You have claimed your daily reward!`)
                .addFields(
                    { name: 'Base reward', value: `${EMOJIS.coin.text} ${BASE_REWARD.toLocaleString()}`, inline: true },
                    { name: `Streak (${EMOJIS.fire.text} ${currentStreak} days)`, value: `${EMOJIS.coin.text} ${streakBonus.toLocaleString()}`, inline: true },
                    { name: 'Total reward', value: `**${EMOJIS.coinbag.text} ${totalReward.toLocaleString()}**`, inline: false },
                    { name: 'Wallet', value: `${EMOJIS.wallet.text} ${userProfile.wallet.toLocaleString()}`, inline: false }
                )
                .setTimestamp()
                .setFooter({ text: 'Come tomorrow to keep the streak!' });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error en /daily:', error);
            await interaction.editReply({ content: 'Ocurrió un error al reclamar tu recompensa.', ephemeral: true });
        }
    },
};
