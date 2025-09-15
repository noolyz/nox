// commands/gambling/chicken.js

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Profile = require('../../models/Profile');
const { EMOJIS } = require('../../gameConfig');

// --- GAME CONFIGURATION ---
const MIN_BET = 20;
const MAX_BET = 25000;
const TOTAL_LANES = 10;
const BET_ADJUSTMENTS = [10, 100, 1000];

const LANE_DATA = [
    { successChance: 0.95, multiplier: 1.1 }, { successChance: 0.90, multiplier: 1.3 },
    { successChance: 0.85, multiplier: 1.6 }, { successChance: 0.75, multiplier: 2.0 },
    { successChance: 0.65, multiplier: 2.5 }, { successChance: 0.55, multiplier: 3.5 },
    { successChance: 0.45, multiplier: 5.0 }, { successChance: 0.35, multiplier: 8.0 },
    { successChance: 0.25, multiplier: 15.0 }, { successChance: 0.15, multiplier: 50.0 },
];

const successMessages = [
    "The chicken crosses the road safely!", "The chicken narrowly avoids a truck!", "An elderly woman on a scooter stops just in time!", "The chicken jumps over a sports car!", "The chicken runs faster than a motorcycle!", "A cyclist swerves to avoid the chicken!", "The chicken tiptoes past a sleeping dog!", "A bus honks, but the chicken keeps going!", "The chicken dodges a puddle with style!", "A skateboarder cheers as the chicken passes!", "The chicken flaps its wings and glides over a pothole!", "A child waves at the chicken from the sidewalk!", "The chicken pauses, then sprints past a taxi!", "A street musician plays a tune as the chicken crosses!", "The chicken struts confidently past a parade!", "A police officer stops traffic for the chicken!", "The chicken leaps over a pile of leaves!", "A squirrel joins the chicken for a moment!", "The chicken avoids a rolling soccer ball!", "A gust of wind helps the chicken along!"
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('chicken')
        .setDescription('Help a chicken cross the road. The further it goes, the more you win!')
        .addIntegerOption(option => option.setName('bet').setDescription(`The amount of CHIPS to bet (between ${MIN_BET} and ${MAX_BET}).`).setRequired(true)),

    async execute(interaction) {
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;
        
        let initialBet = interaction.options.getInteger('bet');
        let currentBet = initialBet;
        let userProfile = await Profile.findOne({ userId, guildId });

        if (!userProfile) {
            const embed = new EmbedBuilder().setColor(0xED4245).setTitle('No Profile Found').setDescription('First you need a profile. Use `/profile` to get started.');
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
        if (initialBet < MIN_BET || initialBet > MAX_BET) {
            const embed = new EmbedBuilder().setColor(0xED4245).setTitle('Invalid Bet').setDescription(`The bet must be between **${MIN_BET}** and **${MAX_BET}** chips.`);
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
        if (initialBet > userProfile.chips) {
            const embed = new EmbedBuilder().setColor(0xED4245).setTitle('Insufficient Chips').setDescription(`You don't have enough chips. You have **${userProfile.chips.toLocaleString()}** ${EMOJIS.chips.text}. Use \`/chips buy\` to get more.`);
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        await interaction.deferReply();

        let currentLane = 0;
        let potentialWinnings = 0;
        let gameState = 'playing'; // playing, ended, betting
        let collector;

        const runGame = async (betAmount) => {
            userProfile = await Profile.findOne({ userId, guildId });
            if (betAmount > userProfile.chips) {
                const embed = new EmbedBuilder().setColor(0xED4245).setTitle('Insufficient Chips').setDescription(`You don't have enough chips. You have **${userProfile.chips.toLocaleString()}** ${EMOJIS.chips.text}.`);
                await interaction.editReply({ embeds: [embed], components: [] });
                if (collector) collector.stop();
                return;
            }
            userProfile.chips -= betAmount;
            await userProfile.save();

            currentLane = 0;
            potentialWinnings = 0;
            gameState = 'playing';
            
            await interaction.editReply({ embeds: [generateEmbed()], components: generateComponents() });
            collector.resetTimer({ time: 180000 });
        };

        const generateEmbed = () => {
            if (gameState === 'betting') {
                return new EmbedBuilder()
                    .setColor(0x5865F2)
                    .setTitle('New Game')
                    .setDescription(`Your last bet was **${initialBet.toLocaleString()}** ${EMOJIS.chips.text}\nAdjust your new bet below.`)
                    .addFields({ name: 'Current Bet', value: `**${currentBet.toLocaleString()}** ${EMOJIS.chips.text}` });
            }

            const roadVisual = (EMOJIS.road_safe.text.repeat(currentLane) + EMOJIS.chicken.text + EMOJIS.road_empty.text.repeat(TOTAL_LANES - currentLane));
            const currentMultiplier = currentLane > 0 ? LANE_DATA[currentLane - 1].multiplier : 1;
            potentialWinnings = Math.floor(currentBet * currentMultiplier);

            return new EmbedBuilder()
                .setColor(0xFEE75C)
                .setTitle('The chicken is crossing the road')
                .setDescription(currentLane > 0 ? successMessages[Math.floor(Math.random() * successMessages.length)] : 'The chicken is standing at the edge of the sidewalk, ready for adventure.')
                .addFields(
                    { name: 'Progress', value: roadVisual },
                    { name: 'Current Lane', value: `${currentLane} / ${TOTAL_LANES}`, inline: true },
                    { name: 'Potential Winnings', value: `**${potentialWinnings.toLocaleString()}** ${EMOJIS.chips.text}`, inline: true }
                )
                .setFooter({ text: `Initial Bet: ${currentBet.toLocaleString()} chips` });
        };
        
        const generateComponents = () => {
            if (gameState === 'ended') {
                // --- FIX IS HERE ---
                return [new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('repeat_bet_chicken').setLabel('Repeat Bet').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('change_bet_chicken').setLabel('Change Bet').setStyle(ButtonStyle.Primary)
                )];
            }
            if (gameState === 'betting') {
                const row1 = new ActionRowBuilder();
                BET_ADJUSTMENTS.forEach(amount => {
                    row1.addComponents(new ButtonBuilder().setCustomId(`decrease_${amount}`).setLabel(`-${amount}`).setStyle(ButtonStyle.Danger));
                });
                const row2 = new ActionRowBuilder();
                BET_ADJUSTMENTS.forEach(amount => {
                    row2.addComponents(new ButtonBuilder().setCustomId(`increase_${amount}`).setLabel(`+${amount}`).setStyle(ButtonStyle.Success));
                });
                const row3 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('start_new_bet').setLabel(`Bet ${currentBet.toLocaleString()}`).setStyle(ButtonStyle.Primary)
                );
                return [row1, row2, row3];
            }

            const currentMultiplier = currentLane > 0 ? LANE_DATA[currentLane - 1].multiplier : 1;
            return [new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('advance').setLabel('Cross').setStyle(ButtonStyle.Success).setEmoji(EMOJIS.next.id).setDisabled(currentLane >= TOTAL_LANES),
                new ButtonBuilder().setCustomId('multiplier').setLabel(`x${currentMultiplier.toFixed(1)}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
                new ButtonBuilder().setCustomId('cashout').setLabel('Cash Out').setEmoji(EMOJIS.chips.id).setStyle(ButtonStyle.Danger).setDisabled(currentLane === 0)
            )];
        };

        const reply = await interaction.editReply({ embeds: [generateEmbed()], components: generateComponents() });
        collector = reply.createMessageComponentCollector({ filter: i => i.user.id === userId, time: 180000 });

        collector.on('collect', async i => {
            await i.deferUpdate();
            userProfile = await Profile.findOne({ userId, guildId });

            if (gameState === 'ended') {
                if (i.customId === 'repeat_bet_chicken') {
                    if (userProfile.chips < initialBet) {
                        const embed = new EmbedBuilder().setColor(0xED4245).setTitle('Insufficient Chips').setDescription(`You don't have enough chips to repeat your bet of **${initialBet.toLocaleString()}** ${EMOJIS.chips.text}.`);
                        return i.followUp({ embeds: [embed], ephemeral: true });
                    }
                    currentBet = initialBet;
                    return runGame(currentBet);
                } else if (i.customId === 'change_bet_chicken') {
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
                if (i.customId === 'start_new_bet') {
                    initialBet = currentBet;
                    return runGame(currentBet);
                }
                return interaction.editReply({ embeds: [generateEmbed()], components: generateComponents() });
            }

            if (i.customId === 'cashout' || (i.customId === 'advance' && currentLane === TOTAL_LANES - 1 && Math.random() < LANE_DATA[currentLane].successChance) ) {
                let finalEmbed;
                if (i.customId === 'cashout') {
                    userProfile.chips += potentialWinnings;
                    userProfile.chickenStats.totalWinnings += potentialWinnings - currentBet;
                    finalEmbed = new EmbedBuilder().setColor(0x57F287).setTitle('Successful Cash Out').setDescription(`You have won **${potentialWinnings.toLocaleString()}** ${EMOJIS.chips.text}.`);
                } else { // Max Win
                    potentialWinnings = Math.floor(currentBet * LANE_DATA[TOTAL_LANES - 1].multiplier);
                    userProfile.chips += potentialWinnings;
                    userProfile.chickenStats.totalWinnings += potentialWinnings - currentBet;
                    finalEmbed = new EmbedBuilder().setColor(0xFFD700).setTitle('MAX WIN!').setDescription(`You did it! You have won the maximum prize of **${potentialWinnings.toLocaleString()}** ${EMOJIS.chips.text}`);
                }
                await userProfile.save();
                finalEmbed.addFields({ name: 'Current Chips', value: `${EMOJIS.chips.text} **${userProfile.chips.toLocaleString()}**` });
                gameState = 'ended';
                await interaction.editReply({ embeds: [finalEmbed], components: generateComponents() });
            } else if (i.customId === 'advance') {
                if (Math.random() < LANE_DATA[currentLane].successChance) {
                    currentLane++;
                    await interaction.editReply({ embeds: [generateEmbed()], components: generateComponents() });
                } else { // Fail
                    const failEmbed = new EmbedBuilder().setColor(0xED4245).setTitle('GAME OVER').setDescription(`Oh no! The chicken was hit in lane **#${currentLane + 1}**.\n\nYou lost your bet of **${currentBet.toLocaleString()}** ${EMOJIS.chips.text}.`).addFields({ name: 'Current Chips', value: `${EMOJIS.chips.text} **${userProfile.chips.toLocaleString()}**` });
                    gameState = 'ended';
                    await interaction.editReply({ embeds: [failEmbed], components: generateComponents() });
                }
            }
        });

        collector.on('end', (collected, reason) => {
            if (gameState === 'playing' && reason === 'time') {
                if (currentLane > 0) {
                    userProfile.chips += potentialWinnings;
                    userProfile.save().then(() => {
                        const timeoutEmbed = new EmbedBuilder().setColor(0x57F287).setTitle('Automatic Cash Out').setDescription(`You took too long to decide and the chicken cashed out for you. You won **${potentialWinnings.toLocaleString()}** ${EMOJIS.chips.text}.`);
                        interaction.editReply({ embeds: [timeoutEmbed], components: [] }).catch(() => {});
                    });
                } else {
                    userProfile.chips += currentBet;
                    userProfile.save().then(() => {
                        interaction.editReply({ content: 'The game has expired and your bet has been returned.', embeds:[], components: [] }).catch(() => {});
                    });
                }
            } else if (gameState !== 'playing') {
                interaction.editReply({ components: [] }).catch(() => {});
            }
        });

        runGame(initialBet);
    },
};

