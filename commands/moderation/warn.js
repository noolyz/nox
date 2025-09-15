// commands/moderation/warn.js

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const Profile = require('../../models/Profile');
const { sendModLog } = require('../../utils/modlog');
const { EMOJIS } = require('../../gameConfig');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Makes an official warning to a user and logs it in their record.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to warn.')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('The reason for the warning.')
                .setRequired(true)),

    async execute(interaction) {
        const target = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason');
        const moderator = interaction.user;
        const guildId = interaction.guild.id;

        if (target.bot) {
            return interaction.reply({ content: `${EMOJIS.error.text} You cannot warn a bot.`, ephemeral: true });
        }
        if (target.id === moderator.id) {
            return interaction.reply({ content: `${EMOJIS.error.text} You cannot warn yourself.`, ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            // Buscamos el perfil del usuario o creamos uno nuevo si no existe.
            const userProfile = await Profile.findOneAndUpdate(
                { userId: target.id, guildId: guildId },
                { $setOnInsert: { userId: target.id, guildId: guildId } }, // Solo establece estos campos si se crea un nuevo documento
                { upsert: true, new: true }
            );

            const newWarning = {
                moderatorId: moderator.id,
                reason: reason,
                date: new Date(),
            };

            // Añadimos la nueva advertencia al expediente del usuario.
            userProfile.warnings.push(newWarning);
            await userProfile.save();

            // Notificar al usuario advertido por DM
            const dmEmbed = new EmbedBuilder()
                .setColor(0xFEE75C)
                .setTitle(`${EMOJIS.emergency.text} You have received a warning in ${interaction.guild.name}`)
                .addFields(
                    { name: `${EMOJIS.scroll.text} Reason`, value: reason },
                    { name: `${EMOJIS.shield.text} Issued by`, value: moderator.tag }
                )
                .setDescription('Please be aware of the server rules to avoid future penalties.');

            await target.send({ embeds: [dmEmbed] }).catch(() => console.log(`Could not send warning DM to ${target.tag}.`));

            // Enviar log de moderación
            await sendModLog(interaction, {
                action: 'Warning',
                color: 0xFEE75C,
                moderator: moderator,
                target: target,
                reason: reason
            });

            const successEmbed = new EmbedBuilder()
                .setColor(0x57F287)
                .setDescription(`${EMOJIS.check.text} The warning for **${target.tag}** has been successfully recorded. They now have **${userProfile.warnings.length}** warning(s).`);

            await interaction.editReply({ embeds: [successEmbed] });

        } catch (error) {
            console.error('Error in /warn:', error);
            const errorEmbed = new EmbedBuilder()
                .setColor(0xED4245)
                .setDescription(`${EMOJIS.error.text} There was an error while registering the warning. Please try again later.`);
            await interaction.editReply({ embeds: [errorEmbed] });
            // Enviar log de error
            await sendErrorLog(interaction, {
                action: 'Warning',
                error: error
            });
        }
    },
};
