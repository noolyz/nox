// commands/gambling/higherlower.js

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Profile = require('../../models/Profile');
const { EMOJIS } = require('../../gameConfig');

// --- GAME CONFIGURATION ---
const MIN_BET = 25;
const MAX_BET = 75000;
const NUMBER_RANGE = { min: 1, max: 100 };
const BET_ADJUSTMENTS = [100, 1000, 10000];

const calculatePayouts = (number) => {
    const range = NUMBER_RANGE.max - NUMBER_RANGE.min;
    const chanceHigher = (NUMBER_RANGE.max - number) / range;
    const chanceLower = (number - NUMBER_RANGE.min) / range;
    const payoutHigher = Math.min(1 / chanceHigher * 0.95, 25);
    const payoutLower = Math.min(1 / chanceLower * 0.95, 25);
    return {
        higher: Math.max(1.05, payoutHigher),
        lower: Math.max(1.05, payoutLower),
        equal: 75,
    };
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('higherlower')
        .setDescription('Guess if the next number will be higher, lower, or equal.')
        .addIntegerOption(option => option.setName('bet').setDescription(`The amount of CHIPS to bet (between ${MIN_BET} and ${MAX_BET}).`).setRequired(true)),

    async execute(interaction) {
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;
        let initialBet = interaction.options.getInteger('bet');

        let userProfile = await Profile.findOne({ userId, guildId });
        if (!userProfile) { 
            const embed = new EmbedBuilder().setColor(0xFF0000).setTitle('Profile Required').setDescription('You need a profile first.');
            return interaction.reply({ embeds: [embed], ephemeral: true }); 
        }
        if (initialBet < MIN_BET || initialBet > MAX_BET) {
            const embed = new EmbedBuilder().setColor(0xFF0000).setTitle('Invalid Bet').setDescription(`The bet must be between **${MIN_BET}** and **${MAX_BET}** chips.`);
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
        // --- CHANGE: Check CHIPS ---
        if (initialBet > userProfile.chips) {
            const embed = new EmbedBuilder().setColor(0xFF0000).setTitle('Insufficient Chips').setDescription(`You do not have enough chips. You have **${userProfile.chips.toLocaleString()}** ${EMOJIS.chips.text}. Use \`/chips buy\`.`);
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        await interaction.deferReply();
        let currentBet = initialBet;
        let gameState = 'playing'; // playing, ended, betting
        let firstNumber;
        let collector;

        const runGame = async (betAmount) => {
            gameState = 'playing';
            userProfile = await Profile.findOne({ userId, guildId });
            if (betAmount > userProfile.chips) {
                await interaction.editReply({ content: 'You do not have enough chips for this bet.', embeds: [], components: [] });
                return;
            }
            // --- CHANGE: Use CHIPS ---
            await Profile.findOneAndUpdate({ userId, guildId }, { $inc: { chips: -betAmount } });

            firstNumber = Math.floor(Math.random() * (NUMBER_RANGE.max - NUMBER_RANGE.min + 1)) + NUMBER_RANGE.min;
            await interaction.editReply(generateUI());
            collector.resetTimer({ time: 60000 });
        };

        const generateUI = () => {
            let embed, components;
            if (gameState === 'betting') {
                embed = new EmbedBuilder().setColor(0x5865F2).setTitle('New Game').setDescription(`Your last bet was **${initialBet.toLocaleString()}** ${EMOJIS.chips.text}`).addFields({ name: 'Current Bet', value: `${EMOJIS.chips.text} **${currentBet.toLocaleString()}**` });
                const row1 = new ActionRowBuilder();
                BET_ADJUSTMENTS.forEach(amount => row1.addComponents(new ButtonBuilder().setCustomId(`decrease_${amount}`).setLabel(`-${amount}`).setStyle(ButtonStyle.Danger)));
                const row2 = new ActionRowBuilder();
                BET_ADJUSTMENTS.forEach(amount => row2.addComponents(new ButtonBuilder().setCustomId(`increase_${amount}`).setLabel(`+${amount}`).setStyle(ButtonStyle.Success)));
                const row3 = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('start_new_bet').setLabel(`Bet ${currentBet.toLocaleString()}`).setStyle(ButtonStyle.Primary));
                components = [row1, row2, row3];
            } else if (gameState === 'playing') {
                const payouts = calculatePayouts(firstNumber);
                embed = new EmbedBuilder().setColor(0xFFFFFF).setTitle('⬆️ Higher or Lower ⬇️').setDescription(`The first number is **${firstNumber}**. Will the next be higher, lower, or equal?`).setFooter({ text: `Your bet: ${currentBet.toLocaleString()} chips` });
                const gameButtons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('higher').setLabel(`Higher (x${payouts.higher.toFixed(2)})`).setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('equal').setLabel(`Equal (x${payouts.equal})`).setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId('lower').setLabel(`Lower (x${payouts.lower.toFixed(2)})`).setStyle(ButtonStyle.Secondary),
                );
                components = [gameButtons];
            } else { // ended
                components = [new ActionRowBuilder().addComponents(
                    // --- CHANGE: New button system ---
                    new ButtonBuilder().setCustomId('repeat_bet_hl').setLabel('Repeat Bet').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('change_bet_hl').setLabel('Change Bet').setStyle(ButtonStyle.Primary)
                )];
                return { components };
            }
            return { embeds: [embed], components };
        };

        const reply = await interaction.editReply({ content: 'Starting...', embeds: [], components: [] });
        collector = reply.createMessageComponentCollector({ filter: i => i.user.id === userId, time: 300000 });

        collector.on('collect', async i => {
            await i.deferUpdate();
            userProfile = await Profile.findOne({ userId, guildId });

            if (gameState === 'playing') {
                const choice = i.customId;
                const revealingEmbed = new EmbedBuilder().setColor(0xFEE75C).setTitle('Revealing the number...').setDescription(`The first number is **${firstNumber}**.\nThe second number is... **[ ❓ ]**`);
                await interaction.editReply({ embeds: [revealingEmbed], components: [] });

                setTimeout(async () => {
                    const secondNumber = Math.floor(Math.random() * (NUMBER_RANGE.max - NUMBER_RANGE.min + 1)) + NUMBER_RANGE.min;
                    let outcome;
                    if (secondNumber > firstNumber) outcome = 'higher';
                    else if (secondNumber < firstNumber) outcome = 'lower';
                    else outcome = 'equal';

                    const win = choice === outcome;
                    const payouts = calculatePayouts(firstNumber);
                    const resultEmbed = new EmbedBuilder();

                    if (win) {
                        const winnings = Math.floor(currentBet * payouts[outcome]);
                        // --- CHANGE: Use CHIPS ---
                        await Profile.findOneAndUpdate({userId, guildId}, { $inc: { chips: winnings + currentBet }});
                        resultEmbed.setColor(0x57F287).setTitle(`You Won! The number was ${secondNumber}.`).setDescription(`Congratulations! You won **${winnings.toLocaleString()} ${EMOJIS.chips.text}**.`);
                    } else {
                        resultEmbed.setColor(0xED4245).setTitle(`You Lost! The number was ${secondNumber}.`).setDescription(`Bad luck. You lost your bet of **${currentBet.toLocaleString()} ${EMOJIS.chips.text}**.`);
                    }
                    const finalProfile = await Profile.findOne({userId, guildId});
                    resultEmbed.addFields({ name: 'Current Chips', value: `${EMOJIS.chips.text} **${finalProfile.chips.toLocaleString()}**` });
                    gameState = 'ended';
                    const ui = generateUI();
                    await interaction.editReply({ embeds: [resultEmbed], components: ui.components });
                    collector.resetTimer({ time: 60000 });
                }, 2000);
            } else if (gameState === 'ended') {
                if (i.customId === 'repeat_bet_hl') {
                    runGame(currentBet);
                } else if (i.customId === 'change_bet_hl') {
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
                    await Profile.findOneAndUpdate({userId, guildId}, { $inc: { chips: currentBet }});
                    await interaction.editReply({ content: 'The betting session has expired and your bet has been returned.', embeds: [], components: [] });
                } else {
                    await interaction.editReply({ content: 'The game session has expired.', components: [] }).catch(() => {});
                }
            }
        });

        runGame(initialBet);
    },
};
