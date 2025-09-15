// commands/gambling/chips.js

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Profile = require('../../models/Profile');
const { EMOJIS } = require('../../gameConfig');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('chips')
        .setDescription('Manage your casino chips.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('buy')
                .setDescription('Convert money from your wallet into casino chips.')
                .addStringOption(option => 
                    option.setName('amount')
                        .setDescription('The amount of chips to buy, or "all".')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('trade')
                .setDescription('Trade your casino chips back into money.')
                .addStringOption(option =>
                    option.setName('amount')
                        .setDescription('The amount of chips to trade, or "all".')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('balance')
                .setDescription('Check your or another user\'s chip balance.')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user whose balance you want to see.')
                        .setRequired(false))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;

        await interaction.deferReply();

        if (subcommand === 'balance') {
            const targetUser = interaction.options.getUser('user') || interaction.user;
            const userProfile = await Profile.findOne({ userId: targetUser.id, guildId });

            if (!userProfile) {
                return interaction.editReply(`${targetUser.username} doesn't have a profile yet.`);
            }

            const balanceEmbed = new EmbedBuilder()
                .setColor(0xFEE75C)
                .setTitle(`${EMOJIS.chips.text} Chip Balance`)
                .setAuthor({ name: targetUser.username, iconURL: targetUser.displayAvatarURL() })
                .setDescription(`**${userProfile.chips.toLocaleString()}** chips`)
                .setTimestamp();

            return interaction.editReply({ embeds: [balanceEmbed] });
        }
        
        // --- Buy/Trade Logic ---
        const amountString = interaction.options.getString('amount');
        const userProfile = await Profile.findOne({ userId, guildId });
        if (!userProfile) {
            return interaction.editReply('You need a profile first. Use `/profile` to get started.');
        }

        if (subcommand === 'buy') {
            const amountToBuy = amountString.toLowerCase() === 'all' ? userProfile.wallet : parseInt(amountString);

            if (isNaN(amountToBuy) || amountToBuy <= 0) {
                return interaction.editReply('Please provide a valid amount to buy.');
            }
            if (amountToBuy > userProfile.wallet) {
                return interaction.editReply(`You don't have enough money in your wallet. You only have **${userProfile.wallet.toLocaleString()}** ${EMOJIS.coin.text}.`);
            }

            userProfile.wallet -= amountToBuy;
            userProfile.chips += amountToBuy;
            await userProfile.save();

            const successEmbed = new EmbedBuilder()
                .setColor(0x57F287)
                .setTitle(`${EMOJIS.chips.text} Chip Purchase Confirmation`)
                .setDescription(`You have successfully purchased **${amountToBuy.toLocaleString()}** chips.`)
                .addFields(
                    { name: 'New Wallet Balance', value: `${EMOJIS.wallet.text} ${userProfile.wallet.toLocaleString()}`, inline: true },
                    { name: 'New Chip Balance', value: `${EMOJIS.chips.text} ${userProfile.chips.toLocaleString()}`, inline: true }
                )
                .setFooter({ text: 'Transaction complete.' });

            await interaction.editReply({ embeds: [successEmbed] });

        } else if (subcommand === 'trade') {
            const amountToTrade = amountString.toLowerCase() === 'all' ? userProfile.chips : parseInt(amountString);

            if (isNaN(amountToTrade) || amountToTrade <= 0) {
                return interaction.editReply('Please provide a valid amount to trade.');
            }
            if (amountToTrade > userProfile.chips) {
                return interaction.editReply(`You don't have enough chips. You only have **${userProfile.chips.toLocaleString()}** ${EMOJIS.chips.text}.`);
            }

            userProfile.chips -= amountToTrade;
            userProfile.wallet += amountToTrade;
            await userProfile.save();

            const successEmbed = new EmbedBuilder()
                .setColor(0x3498DB)
                .setTitle(`${EMOJIS.wallet.text} Chip Trade-in Confirmation`)
                .setDescription(`You have successfully traded in **${amountToTrade.toLocaleString()}** chips.`)
                .addFields(
                    { name: 'New Chip Balance', value: `${EMOJIS.chips.text} ${userProfile.chips.toLocaleString()}`, inline: true },
                    { name: 'New Wallet Balance', value: `${EMOJIS.wallet.text} ${userProfile.wallet.toLocaleString()}`, inline: true }
                )
                .setFooter({ text: 'Transaction complete.' });
            
            await interaction.editReply({ embeds: [successEmbed] });
        }
    },
};

