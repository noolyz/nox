// commands/economy/deposit.js

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Profile = require('../../models/Profile');
const { EMOJIS } = require('../../gameConfig')

module.exports = {
    data: new SlashCommandBuilder()
        .setName('deposit')
        .setDescription('Deposit money into your bank account.')
        // Cambiamos a addStringOption para aceptar "all" y números como texto.
        .addStringOption(option =>
            option.setName('amount')
                .setDescription('The amount to deposit or type "all" to deposit everything.')
                .setRequired(true)),

    async execute(interaction) {
        const amountString = interaction.options.getString('amount');
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;

        await interaction.deferReply({ ephemeral: true });

        try {
            const userProfile = await Profile.findOne({ userId, guildId });

            if (!userProfile || userProfile.wallet <= 0) {
                const errorEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('Deposit Failed')
                    .setDescription('You dont have money on your wallet to deposit.');
                return interaction.editReply({ embeds: [errorEmbed] });
            }

            let amountToDeposit;

            // Lógica para manejar la entrada "all" (insensible a mayúsculas/minúsculas)
            if (amountString.toLowerCase() === 'all') {
                amountToDeposit = userProfile.wallet;
            } else {
                // Si no es "all", intentamos convertirlo a número.
                amountToDeposit = parseInt(amountString, 10);

                // Verificamos si la entrada es un número válido y positivo.
                if (isNaN(amountToDeposit) || amountToDeposit <= 0) {
                    const errorEmbed = new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setTitle('Deposit Failed')
                        .setDescription('Please, type a valid number and positive, or type "all".');
                    return interaction.editReply({ embeds: [errorEmbed] });
                }

                // Verificamos si el usuario tiene suficientes fondos.
                if (amountToDeposit > userProfile.wallet) {
                    const errorEmbed = new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setTitle('Deposit Failed')
                        .setDescription(`You can't deposit more money than you have. Your wallet: ${EMOJIS.wallet.text} **${userProfile.wallet.toLocaleString()}**.`);
                    return interaction.editReply({ embeds: [errorEmbed] });
                }
            }

            // Actualizamos el perfil en la base de datos.
            userProfile.wallet -= amountToDeposit;
            userProfile.bank += amountToDeposit;
            await userProfile.save();

            const successEmbed = new EmbedBuilder()
                .setColor(0x3A4B41)
                .setTitle('Deposit Successful')
                .setDescription(`You have successfully deposited **${amountToDeposit.toLocaleString()}** ${EMOJIS.coin.text}.`)
                .addFields([
                    { name: 'New Balance', value: `${EMOJIS.wallet.text} **${userProfile.wallet.toLocaleString()}** | ${EMOJIS.bank.text} **${userProfile.bank.toLocaleString()}**` }
                ]);

            interaction.editReply({ embeds: [successEmbed] });

        } catch (error) {
            console.error('Error en /deposit:', error);
            interaction.editReply('Ocurrió un error al realizar el depósito.');
        }
    },
};
