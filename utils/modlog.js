// utils/modlog.js

const { EmbedBuilder } = require('discord.js');
const GuildConfig = require('../models/GuildConfig');
const { EMOJIS } = require('../gameConfig');

/**
 * Envía un embed de log al canal de moderación configurado.
 * @param {import('discord.js').CommandInteraction} interaction - La interacción que originó la acción.
 * @param {object} logData - Los datos para el log.
 */
async function sendModLog(interaction, logData) {
    try {
        const config = await GuildConfig.findOne({ guildId: interaction.guild.id });
        if (!config || !config.modLogChannel) {
            return;
        }

        const logChannel = await interaction.guild.channels.fetch(config.modLogChannel).catch(() => null);
        if (!logChannel) {
            return;
        }

        const timestamp = Math.floor(Date.now() / 1000);

        const logEmbed = new EmbedBuilder()
            .setColor(logData.color)
            .setTitle(`${EMOJIS.justice.text} Mod logs ${logData.action}`)
            .setAuthor({ name: logData.moderator.tag, iconURL: logData.moderator.displayAvatarURL() })
            .setTimestamp();

        // Lógica inteligente para diferentes tipos de logs
        if (logData.target) {
            // Formato para acciones contra usuarios (kick, ban, warn)
            logEmbed.addFields(
                { name: `${EMOJIS.profile.text} User`, value: `${logData.target.tag} (${logData.target.id})`, inline: false },
                { name: `${EMOJIS.shield.text} Moderator`, value: `${logData.moderator.tag} (${logData.moderator.id})`, inline: false },
                { name: `${EMOJIS.scroll.text} Reason`, value: logData.reason || 'No reason provided.', inline: false },
                { name: `${EMOJIS.waiting.text} Event Time`, value: `<t:${timestamp}:F> (<t:${timestamp}:R>)`, inline: false }
            );
            logEmbed.setFooter({ text: `User ID: ${logData.target.id}` });
        } else if (logData.channel) {
            // Formato para acciones en canales (lockdown, clear)
            logEmbed.addFields(
                { name: `${EMOJIS.shield.text} Moderator`, value: `${logData.moderator.tag} (${logData.moderator.id})`, inline: false },
                { name: `${EMOJIS.message.text} Affected Channel`, value: `${logData.channel}`, inline: false },
                { name: `${EMOJIS.scroll.text} Details`, value: logData.reason || 'No details provided.', inline: false },
                { name: `${EMOJIS.waiting.text} Event Time`, value: `<t:${timestamp}:F> (<t:${timestamp}:R>)`, inline: false }
            );
            logEmbed.setFooter({ text: `Moderator ID: ${logData.moderator.id}` });
        }

        await logChannel.send({ embeds: [logEmbed] });

    } catch (error) {
        console.error('Error al enviar el log de moderación:', error);
    }
}

module.exports = { sendModLog };
