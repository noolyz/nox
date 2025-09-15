// commands/economy/bank.js

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Profile = require('../../models/Profile');
const { EMOJIS } = require('../../gameConfig');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bank')
        .setDescription('Shows the status of your wallet and bank account.')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user whose account you want to see.')
                .setRequired(false)),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('user') || interaction.user;

        if (targetUser.bot) {
            return interaction.reply({ content: 'Bots don\'t have bank accounts.', ephemeral: true });
        }

        await interaction.deferReply();

        try {
            let userProfile = await Profile.findOne({ 
                userId: targetUser.id, 
                guildId: interaction.guild.id 
            });

            if (!userProfile) {
                userProfile = await Profile.create({
                    userId: targetUser.id,
                    guildId: interaction.guild.id,
                });
            }

            // FIX 2: Añadimos una comprobación de seguridad. Si wallet o bank no existen en la DB, los tratamos como 0.
            // Esto previene el error si un perfil está incompleto.
            const walletAmount = userProfile.wallet ?? 0;
            const bankAmount = userProfile.bank ?? 0;
            const totalMoney = walletAmount + bankAmount;

            const embed = new EmbedBuilder()
                .setColor(0x23b55d)
                .setTitle(`${EMOJIS.bank.text} Bank account of ${targetUser.username}`)
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                .addFields(
                    { name: `${EMOJIS.wallet.text} Wallet`, value: `**${walletAmount.toLocaleString()}** ${EMOJIS.coin.text}`, inline: true },
                    { name: `${EMOJIS.bank.text} Bank`, value: `**${bankAmount.toLocaleString()}** ${EMOJIS.coin.text}`, inline: true },
                    { name: `${EMOJIS.coinstack.text} Total`, value: `**${totalMoney.toLocaleString()}** ${EMOJIS.coin.text}`, inline: true }
                )
                .setTimestamp()
                .setFooter({ text: `Client since ${userProfile.createdAt ? userProfile.createdAt.toLocaleDateString() : new Date().toLocaleDateString()}` });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error en /bank:', error);
            await interaction.editReply({ content: 'There was an error while fetching the account.', ephemeral: true });
        }
    },
};
