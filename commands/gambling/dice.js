// commands/gambling/dice.js

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Profile = require('../../models/Profile');
const { EMOJIS } = require('../../gameConfig');

// --- GAME CONFIGURATION ---
const MIN_BET = 50;
const MAX_BET = 100000;
const BET_ADJUSTMENTS = [100, 1000, 10000];
const PAYOUTS = {
    under: 2,
    over: 2,
    seven: 5,
};
const DICE_EMOJIS = ['<:dice1:1412071241107640443>', '<:dice2:1412071230433001735>', '<:dice3:1412071218345017496>', '<:dice4:1412071207590826175>', '<:dice5:1412071198325604453>', '<:dice6:1412071185046573136>'];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dice')
        .setDescription('Bet if the sum of two dice will be higher, lower, or equal to 7.')
        .addIntegerOption(option => option.setName('bet').setDescription(`The amount of CHIPS to bet (between ${MIN_BET} and ${MAX_BET}).`).setRequired(true)),

    async execute(interaction) {
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;
        let initialBet = interaction.options.getInteger('bet');

        let userProfile = await Profile.findOne({ userId, guildId });
        if (!userProfile) return interaction.reply({ content: 'You need a profile first.', ephemeral: true });
        if (initialBet < MIN_BET || initialBet > MAX_BET) return interaction.reply({ content: `The bet must be between **${MIN_BET}** and **${MAX_BET}** chips.`, ephemeral: true });
        // --- CHANGE: Check CHIPS ---
        if (initialBet > userProfile.chips) return interaction.reply({ content: `You do not have enough chips. You have **${userProfile.chips.toLocaleString()}** ${EMOJIS.chips.text}. Use \`/chips buy\`.`, ephemeral: true });

        await interaction.deferReply();
        let currentBet = initialBet;
        let gameState = 'playing'; // playing, ended, betting
        let collector;

        const runGame = async (betAmount) => {
            gameState = 'playing';
            userProfile = await Profile.findOne({ userId, guildId });
            if (betAmount > userProfile.chips) {
                const embed = new EmbedBuilder().setColor(0xE91E63).setDescription('You do not have enough chips for this bet.');
                await interaction.editReply({ embeds: [embed], components: [] });
                return collector.stop();
            }
            // --- CHANGE: Use CHIPS ---
            await Profile.findOneAndUpdate({ userId, guildId }, { $inc: { chips: -betAmount } });

            const bettingEmbed = new EmbedBuilder()
                .setColor(0xE91E63)
                .setTitle('Dice Roll')
                .setDescription('Choose your prediction. How will the dice land?')
                .setFooter({ text: `Your bet: ${betAmount.toLocaleString()} chips` });
            
            const bettingButtons = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('under').setLabel(`Under 7 (x${PAYOUTS.under})`).setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('seven').setLabel(`Exactly 7 (x${PAYOUTS.seven})`).setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('over').setLabel(`Over 7 (x${PAYOUTS.over})`).setStyle(ButtonStyle.Secondary)
            );

            await interaction.editReply({ embeds: [bettingEmbed], components: [bettingButtons] });
            collector.resetTimer({ time: 60000 });
        };

        const generateUI = () => {
            let embed, components;
            if (gameState === 'betting') {
                embed = new EmbedBuilder().setColor(0x5865F2).setTitle('New Dice Game').setDescription(`Your last bet was **${initialBet.toLocaleString()}** ${EMOJIS.chips.text}`).addFields({ name: 'Current Bet', value: `${EMOJIS.chips.text} **${currentBet.toLocaleString()}**` });
                const row1 = new ActionRowBuilder();
                BET_ADJUSTMENTS.forEach(amount => row1.addComponents(new ButtonBuilder().setCustomId(`decrease_${amount}`).setLabel(`-${amount}`).setStyle(ButtonStyle.Danger)));
                const row2 = new ActionRowBuilder();
                BET_ADJUSTMENTS.forEach(amount => row2.addComponents(new ButtonBuilder().setCustomId(`increase_${amount}`).setLabel(`+${amount}`).setStyle(ButtonStyle.Success)));
                const row3 = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('start_new_bet').setLabel(`Bet ${currentBet.toLocaleString()}`).setStyle(ButtonStyle.Primary));
                components = [row1, row2, row3];
            } else { // ended
                components = [new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('repeat_bet_dice').setLabel('Repeat Bet').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('change_bet_dice').setLabel('Change Bet').setStyle(ButtonStyle.Primary)
                )];
                return { components }; // No embed needed here
            }
            return { embeds: [embed], components };
        };

        const reply = await interaction.editReply({ content: 'Loading game...', embeds: [], components: [] });
        collector = reply.createMessageComponentCollector({ filter: i => i.user.id === userId, time: 300000 });

        collector.on('collect', async i => {
            await i.deferUpdate();
            userProfile = await Profile.findOne({ userId, guildId });

            if (gameState === 'playing') {
                const choice = i.customId;
                const rollingEmbed = new EmbedBuilder().setColor(0xFEE75C).setTitle('Rolling the dice...').setDescription('The dice bounce on the cloth... **[ 🎲 | 🎲 ]**');
                await interaction.editReply({ embeds: [rollingEmbed], components: [] });

                setTimeout(async () => {
                    const die1 = Math.floor(Math.random() * 6) + 1;
                    const die2 = Math.floor(Math.random() * 6) + 1;
                    const sum = die1 + die2;
                    let outcome;
                    if (sum < 7) outcome = 'under';
                    else if (sum > 7) outcome = 'over';
                    else outcome = 'seven';

                    const win = choice === outcome;
                    let winnings = 0;
                    const resultEmbed = new EmbedBuilder().setDescription(`Rolled **${DICE_EMOJIS[die1 - 1]} and ${DICE_EMOJIS[die2 - 1]}**, totaling **${sum}**.`);

                    if (win) {
                        winnings = Math.floor(currentBet * PAYOUTS[outcome]);
                        // --- CHANGE: Use CHIPS ---
                        await Profile.findOneAndUpdate({ userId, guildId }, { $inc: { chips: winnings + currentBet } });
                        resultEmbed.setColor(0x57F287).setTitle(`You Won!`);
                        resultEmbed.addFields({ name: 'Prize', value: `${EMOJIS.chips.text} **+${winnings.toLocaleString()}**` });
                    } else {
                        resultEmbed.setColor(0xED4245).setTitle(`You Lost!`);
                        resultEmbed.addFields({ name: 'Loss', value: `${EMOJIS.chips.text} **-${currentBet.toLocaleString()}**` });
                    }
                    
                    const finalProfile = await Profile.findOne({userId, guildId});
                    resultEmbed.addFields({ name: 'Current Chips', value: `${EMOJIS.chips.text} **${finalProfile.chips.toLocaleString()}**` });
                    gameState = 'ended';
                    const ui = generateUI();
                    await interaction.editReply({ embeds: [resultEmbed], components: ui.components });
                    collector.resetTimer({ time: 60000 });
                }, 2500);

            } else if (gameState === 'ended') {
                if (i.customId === 'repeat_bet_dice') {
                    runGame(currentBet);
                } else if (i.customId === 'change_bet_dice') {
                    gameState = 'betting';
                    const ui = generateUI();
                    await interaction.editReply({ embeds: ui.embeds, components: ui.components });
                    collector.resetTimer({ time: 60000 });
                }
            } else if (gameState === 'betting') {
                if (i.customId.startsWith('decrease_')) currentBet = Math.max(MIN_BET, currentBet - parseInt(i.customId.split('_')[1]));
                if (i.customId.startsWith('increase_')) currentBet = Math.min(MAX_BET, userProfile.chips, currentBet + parseInt(i.customId.split('_')[1]));
                
                if (i.customId === 'start_new_bet') {
                    initialBet = currentBet;
                    runGame(currentBet);
                } else {
                    const ui = generateUI();
                    await interaction.editReply({ embeds: ui.embeds, components: ui.components });
                }
            }
        });

        collector.on('end', async (collected, reason) => {
            if (reason === 'time') {
                if (gameState === 'playing') {
                    await Profile.findOneAndUpdate({ userId, guildId }, { $inc: { chips: currentBet } });
                    await interaction.editReply({ content: 'The betting session has expired and your bet has been returned.', embeds: [], components: [] });
                } else {
                    await interaction.editReply({ content: 'The game session has expired.', embeds: [], components: [] }).catch(() => {});
                }
            }
        });

        runGame(initialBet);
    },
};
