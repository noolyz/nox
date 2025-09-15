// commands/economy/withdraw.js

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Profile = require('../../models/Profile');
const { EMOJIS } = require('../../gameConfig');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('withdraw')
        .setDescription('Withdraw money from your bank account.')
        // Cambiamos a addStringOption para aceptar "all" y números como texto.
        .addStringOption(option =>
            option.setName('amount')
                .setDescription('The amount to withdraw or type "all" to withdraw everything.')
                .setRequired(true)),

    async execute(interaction) {
        const amountString = interaction.options.getString('amount');
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;

        await interaction.deferReply({ ephemeral: true });

        try {
            const userProfile = await Profile.findOne({ userId, guildId });

            if (!userProfile || userProfile.bank <= 0) {
                const errorEmbed = new EmbedBuilder()
                    .setColor(0xff0000)
                    .setTitle('Insufficient Funds')
                    .setDescription('You don\'t have money on your bank to withdraw.');
                return interaction.editReply({ embeds: [errorEmbed] });
            }

            let amountToWithdraw;

            // Lógica para manejar la entrada "all"
            if (amountString.toLowerCase() === 'all') {
                amountToWithdraw = userProfile.bank;
            } else {
                // Si no es "all", intentamos convertirlo a número.
                amountToWithdraw = parseInt(amountString, 10);

                // Verificamos si la entrada es un número válido y positivo.
                if (isNaN(amountToWithdraw) || amountToWithdraw <= 0) {
                    const errorEmbed = new EmbedBuilder()
                        .setColor(0xff0000)
                        .setTitle('Invalid Amount')
                        .setDescription('Please, introduce a positive and valid number, or type all.');
                    return interaction.editReply({ embeds: [errorEmbed] });
                }

                // Verificamos si el usuario tiene suficientes fondos en el banco.
                if (amountToWithdraw > userProfile.bank) {
                    const errorEmbed = new EmbedBuilder()
                        .setColor(0xff0000)
                        .setTitle('Insufficient Funds')
                        .setDescription(`You cannot withdraw more than you have. Your bank balance: ${EMOJIS.bank.text} **${userProfile.bank.toLocaleString()}** ${EMOJIS.coin.text}`);
                    return interaction.editReply({ embeds: [errorEmbed] });
                }
            }

            // Actualizamos el perfil en la base de datos.
            userProfile.bank -= amountToWithdraw;
            userProfile.wallet += amountToWithdraw;
            await userProfile.save();

            const successEmbed = new EmbedBuilder()
                .setColor(0x3A4B41)
                .setTitle('Withdrawal Successful')
                .setDescription(`You have successfully withdrawn **${amountToWithdraw.toLocaleString()}** ${EMOJIS.coin.text}`)
                .addFields([
                    { name: 'New Balance', value: `${EMOJIS.wallet.text} **${userProfile.wallet.toLocaleString()}** | ${EMOJIS.bank.text} **${userProfile.bank.toLocaleString()}**` }
                ]);

            interaction.editReply({ embeds: [successEmbed] });

        } catch (error) {
            console.error('Error en /withdraw:', error);
            interaction.editReply('Ocurrió un error al realizar el retiro.');
        }
    },
};
