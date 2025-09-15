// commands/economy/wallet.js

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Profile = require('../../models/Profile');
const { EMOJIS } = require('../../gameConfig');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('wallet')
        .setDescription('Shows how much money you have in your wallet.')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user whose wallet you want to see.')
                .setRequired(false)),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('user') || interaction.user;

        if (targetUser.bot) {
            return interaction.reply({ content: 'Bots doesn\'t have a wallet. Not even money...', ephemeral: true });
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
            
            const walletAmount = userProfile.wallet ?? 0;

            const embed = new EmbedBuilder()
                .setColor(0xFFA500) // Un color anaranjado para la billetera
                .setTitle(`${EMOJIS.wallet.text} ${targetUser.username}'s wallet`)
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                .setDescription(`Money: **${walletAmount.toLocaleString()}** ${EMOJIS.coin.text}.`)
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error en /wallet:', error);
            await interaction.editReply({ content: 'There was an error retrieving the wallet.', ephemeral: true });
        }
    },
};
