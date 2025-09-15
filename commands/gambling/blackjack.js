// commands/gambling/blackjack.js

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Profile = require('../../models/Profile');
const { BLACKJACK_CONFIG, CUSTOM_CARDS, EMOJIS } = require('../../gameConfig');

const MIN_BET = 100;
const MAX_BET = 500000;
const BET_ADJUSTMENTS = [100, 1000, 10000];

// --- Game Functions (Updated) ---
const createDeck = () => {
    const deck = [];
    const suits = ['♠️', '❤️', '♣️', '♦️'];
    const values = Object.keys(BLACKJACK_CONFIG.values);
    for (const suit of suits) {
        for (const value of values) {
            deck.push({ suit, value });
        }
    }
    return deck;
};

const shuffleDeck = (deck) => {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
};

const getHandValue = (hand) => {
    let value = 0;
    let aceCount = 0;
    for (const card of hand) {
        value += BLACKJACK_CONFIG.values[card.value];
        if (card.value === 'A') aceCount++;
    }
    while (value > 21 && aceCount > 0) {
        value -= 10;
        aceCount--;
    }
    return value;
};

const formatHand = (hand) => hand.map(card => CUSTOM_CARDS[`${card.suit}${card.value}`]).join(' ');


module.exports = {
    data: new SlashCommandBuilder()
        .setName('blackjack')
        .setDescription('Plays a hand of Blackjack against the dealer.')
        .addIntegerOption(option => option.setName('bet').setDescription(`The amount of CHIPS you want to bet (between ${MIN_BET} and ${MAX_BET}).`).setRequired(true)),

    async execute(interaction) {
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;
        let initialBet = interaction.options.getInteger('bet');

        let userProfile = await Profile.findOne({ userId, guildId });
        if (!userProfile) {
            const embed = new EmbedBuilder().setColor(0xFF0000).setDescription('You need to create a profile first.');
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
        if (initialBet < MIN_BET || initialBet > MAX_BET) {
            const embed = new EmbedBuilder().setColor(0xFF0000).setDescription(`The bet must be between **${MIN_BET}** and **${MAX_BET}** ${EMOJIS.chips.text}`);
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
        if (initialBet > userProfile.chips) {
            const embed = new EmbedBuilder().setColor(0xFF0000).setDescription(`You don't have enough chips. You have **${userProfile.chips.toLocaleString()}**${EMOJIS.chips.text}. Use \`/chips buy\` to get more.`);
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        await interaction.deferReply();
        
        let gameState = 'playing';
        let currentBet = initialBet;
        let playerHand, dealerHand, deck;
        let sessionWinnings = 0;

        const generateUI = (resultMessage = null) => {
            const embed = new EmbedBuilder();
            let components = [];

            if (gameState === 'betting') {
                embed.setColor(0x5865F2)
                    .setTitle('New hand')
                    .setDescription(`Your last bet was **${initialBet.toLocaleString()}** ${EMOJIS.chips.text}`)
                    .addFields({ name: 'Current Bet', value: `${EMOJIS.chips.text} **${currentBet.toLocaleString()}**` });

                const row1 = new ActionRowBuilder();
                BET_ADJUSTMENTS.forEach(amount => row1.addComponents(new ButtonBuilder().setCustomId(`decrease_${amount}`).setLabel(`-${amount}`).setStyle(ButtonStyle.Danger)));
                const row2 = new ActionRowBuilder();
                BET_ADJUSTMENTS.forEach(amount => row2.addComponents(new ButtonBuilder().setCustomId(`increase_${amount}`).setLabel(`+${amount}`).setStyle(ButtonStyle.Success)));
                const row3 = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('start_new_bet').setLabel(`Bet ${currentBet.toLocaleString()}`).setStyle(ButtonStyle.Primary));
                components = [row1, row2, row3];
            } else {
                const playerValue = getHandValue(playerHand);
                const dealerValue = getHandValue(dealerHand);
                
                embed.setColor(0x5865F2)
                    .setTitle('Blackjack table')
                    .addFields(
                        { name: `Dealer's Hand (${gameState === 'ended' ? dealerValue : '?'})`, value: gameState === 'ended' ? formatHand(dealerHand) : `${CUSTOM_CARDS[`${dealerHand[0].suit}${dealerHand[0].value}`]} ${CUSTOM_CARDS['HIDDEN']}` },
                        { name: `Your Hand (${playerValue})`, value: formatHand(playerHand) }
                    )
                    .setFooter({ text: `Bet: ${currentBet.toLocaleString()} chips` });

                if (resultMessage) {
                    embed.setDescription(resultMessage);
                    if (resultMessage.includes('won') || resultMessage.includes('BLACKJACK') || resultMessage.includes('Push')) embed.setColor(0x57F287);
                    else embed.setColor(0xED4245);
                }

                if (gameState === 'playing') {
                    components.push(new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('hit').setLabel('Hit').setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId('stand').setLabel('Stand').setStyle(ButtonStyle.Secondary)
                    ));
                } else { // ended
                    components.push(new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('repeat_bet').setLabel('Repeat Bet').setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId('change_bet').setLabel('Change Bet').setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId('leave_table').setLabel('Leave Table').setStyle(ButtonStyle.Danger)
                    ));
                }
            }
            return { embeds: [embed], components };
        };

        const reply = await interaction.editReply({ content: 'The dealer is shuffling the cards...', embeds: [], components: [] });
        const collector = reply.createMessageComponentCollector({ filter: i => i.user.id === userId, time: 300000 });

        const endGame = async (resultMessage, winAmount, statUpdate) => {
            gameState = 'ended';
            // --- FIX IS HERE ---
            sessionWinnings += (winAmount - currentBet); 
            
            await Profile.findOneAndUpdate({ userId, guildId }, {
                $inc: { 
                    'chips': winAmount,
                    'blackjackStats.totalWinnings': (winAmount > currentBet) ? (winAmount - currentBet) : 0
                }
            });
            
            userProfile = await Profile.findOne({ userId, guildId });
            statUpdate(userProfile.blackjackStats);
            userProfile.markModified('blackjackStats');
            await userProfile.save();

            const ui = generateUI(resultMessage);
            await interaction.editReply(ui);
            collector.resetTimer({ time: 60000 });
        };
        
        const handleStand = async () => {
             while (getHandValue(dealerHand) < BLACKJACK_CONFIG.dealer_stands_on) {
                dealerHand.push(deck.pop());
            }
            const playerValue = getHandValue(playerHand);
            const dealerValue = getHandValue(dealerHand);
            
            if (dealerValue > 21 || playerValue > dealerValue) {
                await endGame(`**You won!** The dealer busted or your hand is higher. You win **${currentBet.toLocaleString()}** ${EMOJIS.chips.text}.`, currentBet * 2, stats => stats.wins++);
            } else if (dealerValue > playerValue) {
                await endGame(`**You lost.** The dealer's hand is higher. You lost **${currentBet.toLocaleString()}** ${EMOJIS.chips.text}.`, 0, stats => stats.losses++);
            } else {
                await endGame(`**Push.** You get your bet back.`, currentBet, stats => stats.pushes++);
            }
        };

        const startGame = async (bet) => {
            gameState = 'playing';
            userProfile = await Profile.findOne({ userId, guildId });
            if (bet > userProfile.chips) {
                const embed = new EmbedBuilder().setColor(0xFF0000).setDescription('You do not have enough chips for this bet.');
                await interaction.editReply({ embeds: [embed], components: [] });
                return collector.stop();
            }
            
            await Profile.findOneAndUpdate({ userId, guildId }, { $inc: { chips: -bet } });
            userProfile.chips -= bet; // Update local profile to match

            deck = shuffleDeck(createDeck());
            playerHand = [deck.pop(), deck.pop()];
            dealerHand = [deck.pop(), deck.pop()];

            if (getHandValue(playerHand) === 21) {
                const winnings = Math.floor(bet * BLACKJACK_CONFIG.blackjack_payout);
                await endGame(`**BLACKJACK!** You win **${winnings.toLocaleString()}** ${EMOJIS.chips.text}.`, bet + winnings, stats => stats.wins++);
            } else {
                await interaction.editReply(generateUI());
                collector.resetTimer({ time: 30000 });
            }
        };

        collector.on('collect', async i => {
            await i.deferUpdate();
            userProfile = await Profile.findOne({ userId, guildId });

            if (gameState === 'playing') {
                if (i.customId === 'hit') {
                    playerHand.push(deck.pop());
                    if (getHandValue(playerHand) > 21) {
                        await endGame(`**Busted!** You have ${getHandValue(playerHand)}. You lost **${currentBet.toLocaleString()}** ${EMOJIS.chips.text}.`, 0, stats => stats.losses++);
                    } else {
                        await interaction.editReply(generateUI());
                        collector.resetTimer({ time: 30000 });
                    }
                } else if (i.customId === 'stand') {
                    await handleStand();
                }
            } else if (gameState === 'ended') {
                if (i.customId === 'repeat_bet') {
                    await startGame(currentBet);
                } else if (i.customId === 'change_bet') {
                    gameState = 'betting';
                    await interaction.editReply(generateUI());
                    collector.resetTimer({ time: 60000 });
                } else if (i.customId === 'leave_table') {
                    const leaveEmbed = new EmbedBuilder().setColor(0x99AAB5).setTitle('You left the table').setDescription(`Thanks for playing. Your session balance was **${sessionWinnings.toLocaleString()}** ${EMOJIS.chips.text}.`);
                    await interaction.editReply({ embeds: [leaveEmbed], components: [] });
                    collector.stop();
                }
            } else if (gameState === 'betting') {
                 if (i.customId.startsWith('decrease_')) currentBet = Math.max(MIN_BET, currentBet - parseInt(i.customId.split('_')[1]));
                 if (i.customId.startsWith('increase_')) currentBet = Math.min(MAX_BET, userProfile.chips, currentBet + parseInt(i.customId.split('_')[1]));
                
                if (i.customId === 'start_new_bet') {
                    initialBet = currentBet;
                    await startGame(currentBet);
                } else {
                    await interaction.editReply(generateUI());
                }
            }
        });

        collector.on('end', async (collected, reason) => {
            if (reason === 'time') {
                if (gameState === 'playing') {
                    await interaction.editReply({ content: 'You have automatically stood due to inactivity.', embeds: [generateUI().embeds[0]], components: [] });
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    await handleStand();
                } else {
                    const leaveEmbed = new EmbedBuilder().setColor(0x99AAB5).setTitle('You left the table due to inactivity').setDescription('The session has expired. Come back anytime!');
                    await interaction.editReply({ embeds: [leaveEmbed], components: [] }).catch(() => {});
                }
            }
        });

        await startGame(initialBet);
    },
};

