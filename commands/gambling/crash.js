// commands/gambling/crash.js

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Profile = require('../../models/Profile');
const { EMOJIS } = require('../../gameConfig');

// --- GAME CONFIGURATION ---
const MIN_BET = 50;
const MAX_BET = 100000;
const BET_ADJUSTMENTS = [100, 1000, 10000];
const GAME_TICK_SPEED = 1000;
const INSTANT_CRASH_CHANCE = 0.07;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('crash')
        .setDescription('The classic crash game. Bet on how far the rocket will go before it crashes!')
        .addIntegerOption(option => option.setName('bet').setDescription(`Amount of CHIPS to bet (between ${MIN_BET} and ${MAX_BET}).`).setRequired(true)),

    async execute(interaction) {
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;
        
        let initialBet = interaction.options.getInteger('bet');
        let currentBet = initialBet;
        let userProfile = await Profile.findOne({ userId, guildId });

        if (!userProfile) return interaction.reply({ content: 'You need a profile first. Use `/profile` to start.', ephemeral: true });
        if (initialBet < MIN_BET || initialBet > MAX_BET) return interaction.reply({ content: `Bet must be between **${MIN_BET}** and **${MAX_BET}** chips.`, ephemeral: true });
        // --- CHANGE: Check CHIPS, not wallet ---
        if (initialBet > userProfile.chips) return interaction.reply({ content: `You do not have enough chips. You have **${userProfile.chips.toLocaleString()}** ${EMOJIS.chips.text}. Use \`/chips buy\` to get more.`, ephemeral: true });

        await interaction.deferReply();

        let gameState = 'betting'; // betting, waiting, flying, ended
        let multiplier = 1.0;
        let gameInterval = null;
        let collector;

        const runGame = async (betAmount) => {
            userProfile = await Profile.findOne({ userId, guildId });
            if (betAmount > userProfile.chips) {
                await interaction.editReply({ content: 'You do not have enough funds for this bet.', embeds: [], components: [] });
                collector.stop();
                return;
            }
            // --- CHANGE: Use CHIPS, not wallet ---
            await Profile.findOneAndUpdate({ userId, guildId }, { $inc: { chips: -betAmount } });

            gameState = 'waiting';
            let countdown = 3;
            const countdownInterval = setInterval(async () => {
                const waitingEmbed = new EmbedBuilder()
                    .setColor(0x5865F2)
                    .setTitle('Preparing for Takeoff')
                    .setDescription(`The rocket will launch in **${countdown}...**\n\n**Bet:** ${betAmount.toLocaleString()} ${EMOJIS.chips.text}`);
                await interaction.editReply({ embeds: [waitingEmbed], components: [] });
                countdown--;
                if (countdown < 0) {
                    clearInterval(countdownInterval);
                    startGameLoop(betAmount);
                }
            }, 1000);
        };

        const startGameLoop = (betAmount) => {
            gameState = 'flying';
            multiplier = 1.0;
            let tickCount = 0;

            if (Math.random() < INSTANT_CRASH_CHANCE) {
                endGame(betAmount, true);
                return;
            }

            gameInterval = setInterval(async () => {
                tickCount++;
                const crashChance = 0.01 + (tickCount * 0.006); 
                if (Math.random() < crashChance) {
                    endGame(betAmount, true);
                    return;
                }
                
                multiplier += 0.1 + (tickCount * 0.01); 
                await interaction.editReply({ embeds: [generateEmbed()], components: generateComponents() });
            }, GAME_TICK_SPEED);
        };

        const endGame = async (betAmount, crashed = false) => {
            if (gameInterval) clearInterval(gameInterval);
            gameState = 'ended';

            let finalEmbed;
            if (crashed) {
                finalEmbed = new EmbedBuilder()
                    .setColor(0xED4245)
                    .setTitle(`CRASHED at x${multiplier.toFixed(2)}! ${EMOJIS.supernova.text}`)
                    .setDescription(`The rocket exploded. You lost your bet of **${betAmount.toLocaleString()}** ${EMOJIS.chips.text}.`);
            } else {
                const winnings = Math.floor(betAmount * multiplier);
                // --- CHANGE: Use CHIPS, not wallet ---
                await Profile.findOneAndUpdate({ userId, guildId }, { $inc: { chips: winnings, 'crashStats.totalWinnings': (winnings - betAmount) } });
                finalEmbed = new EmbedBuilder()
                    .setColor(0x57F287)
                    .setTitle(`Successful Cashout at x${multiplier.toFixed(2)}! ${EMOJIS.spaceman.text}`)
                    .setDescription(`You cashed out in time and won **${(winnings - betAmount).toLocaleString()}** ${EMOJIS.chips.text}.`);
            }
            userProfile = await Profile.findOne({userId, guildId});
            finalEmbed.addFields({ name: 'Current Chips', value: `${EMOJIS.chips.text} **${userProfile.chips.toLocaleString()}**` });
            await interaction.editReply({ embeds: [finalEmbed], components: generateComponents() });
            collector.resetTimer({ time: 60000 });
        };

        const generateEmbed = () => {
            if (gameState === 'betting') {
                return new EmbedBuilder()
                    .setColor(0x5865F2)
                    .setTitle('New Crash Game')
                    .setDescription(`Your last bet was **${initialBet.toLocaleString()}** ${EMOJIS.chips.text}.\nAdjust your new bet below.`)
                    .addFields({ name: 'Current Bet', value: `${EMOJIS.chips.text} **${currentBet.toLocaleString()}**` });
            }

            const rocketPosition = Math.min(Math.floor(multiplier), 20);
            const flightPath = EMOJIS.nebula.text.repeat(rocketPosition) + EMOJIS.rocket.text + EMOJIS.nebula.text.repeat(20 - rocketPosition);
            let color = 0x3498DB;
            if (multiplier > 5) color = 0xFFD700;
            else if (multiplier > 2.5) color = 0x57F287;
            
            return new EmbedBuilder()
                .setColor(color)
                .setTitle(`Current Multiplier: x${multiplier.toFixed(2)}`)
                .setDescription(flightPath)
                .addFields({ name: 'Potential Winnings', value: `${EMOJIS.chips.text} **${Math.floor(currentBet * multiplier).toLocaleString()}**` });
        };
        
        const generateComponents = () => {
            if (gameState === 'ended') {
                 // --- FIX: Implement new button system ---
                return [new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('repeat_bet_crash').setLabel('Repeat Bet').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('change_bet_crash').setLabel('Change Bet').setStyle(ButtonStyle.Primary)
                )];
            }
            if (gameState === 'betting') {
                const row1 = new ActionRowBuilder();
                BET_ADJUSTMENTS.forEach(amount => row1.addComponents(new ButtonBuilder().setCustomId(`decrease_${amount}`).setLabel(`-${amount}`).setStyle(ButtonStyle.Danger)));
                const row2 = new ActionRowBuilder();
                BET_ADJUSTMENTS.forEach(amount => row2.addComponents(new ButtonBuilder().setCustomId(`increase_${amount}`).setLabel(`+${amount}`).setStyle(ButtonStyle.Success)));
                const row3 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('start_new_bet_crash').setLabel(`Bet ${currentBet.toLocaleString()}`).setStyle(ButtonStyle.Primary)
                );
                return [row1, row2, row3];
            }
            if (gameState === 'flying') {
                return [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('cashout_crash').setLabel(`Cash Out (x${multiplier.toFixed(2)})`).setStyle(ButtonStyle.Success))];
            }
            return [];
        };

        const reply = await interaction.editReply({ content: 'Starting game...', embeds: [], components: [] });
        collector = reply.createMessageComponentCollector({ filter: i => i.user.id === userId, time: 300000 });

        collector.on('collect', async i => {
            await i.deferUpdate();
            userProfile = await Profile.findOne({ userId, guildId });

            if (i.customId === 'cashout_crash' && gameState === 'flying') {
                endGame(currentBet, false);
                return;
            }

            if (gameState === 'ended') {
                if (i.customId === 'repeat_bet_crash') {
                    currentBet = initialBet;
                    return runGame(currentBet);
                } else if (i.customId === 'change_bet_crash') {
                    gameState = 'betting';
                    currentBet = initialBet;
                    return interaction.editReply({ embeds: [generateEmbed()], components: generateComponents() });
                }
            }

            if (gameState === 'betting') {
                if (i.customId.startsWith('decrease_')) {
                    const amount = parseInt(i.customId.split('_')[1]);
                    currentBet = Math.max(MIN_BET, currentBet - amount);
                }
                if (i.customId.startsWith('increase_')) {
                    const amount = parseInt(i.customId.split('_')[1]);
                    currentBet = Math.min(MAX_BET, userProfile.chips, currentBet + amount);
                }
                if (i.customId === 'start_new_bet_crash') {
                    initialBet = currentBet;
                    return runGame(initialBet);
                }
                return interaction.editReply({ embeds: [generateEmbed()], components: generateComponents() });
            }
        });

        collector.on('end', (collected, reason) => {
            if (gameInterval) clearInterval(gameInterval);
            if (reason === 'time' && (gameState === 'flying' || gameState === 'waiting')) {
                 interaction.editReply({ content: 'The game has expired due to inactivity.', embeds: [], components: [] }).catch(() => {});
            } else if (gameState !== 'ended') {
                 interaction.editReply({ components: [] }).catch(() => {});
            }
        });

        runGame(initialBet);
    },
};
