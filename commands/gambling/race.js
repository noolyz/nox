// commands/gambling/race.js

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const Profile = require('../../models/Profile');
const { RACE_CONFIG, EMOJIS } = require('../../gameConfig');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('race')
        .setDescription('Start a race and bet on your favorite competitor!'),

    async execute(interaction) {
        await interaction.deferReply();

        let gameState = 'betting';
        const bets = new Map(); // userId -> { amount: number, racerId: string }

        const generateBettingEmbed = (timeLeft) => {
            const displayTime = (typeof timeLeft === 'number' && !isNaN(timeLeft) && timeLeft >= 0) ? timeLeft : Math.floor(RACE_CONFIG.betting_window / 1000);
            const embed = new EmbedBuilder()
                .setColor(0xFFD700)
                .setTitle('🏇 Betting is Open! 🏇')
                .setDescription(`A new race is about to begin! You have **${displayTime} seconds** to choose your champion and place your bet using the menu below.`)
                .setThumbnail('https://media.discordapp.net/attachments/1354187398950682684/1412123095120220180/track.png?ex=68b7259d&is=68b5d41d&hm=39cd75986ce39c98c270f4ca93efa444ee4f3a0fb458ad2f60239b14ed0c2293&=&format=webp&quality=lossless&width=350&height=350');

            RACE_CONFIG.racers.forEach(racer => {
                const bettors = Array.from(bets.entries()).filter(([, bet]) => bet.racerId === racer.id);
                const bettorList = bettors.length > 0 ? bettors.map(([userId, bet]) => `<@${userId}> (${bet.amount.toLocaleString()})`).join(', ') : 'No one yet.';
                embed.addFields({ name: `${racer.emoji} ${racer.name}`, value: `Bettors: ${bettorList}`, inline: false });
            });
            return embed;
        };

        const generateBettingComponents = () => {
            const menu = new StringSelectMenuBuilder()
                .setCustomId('select_racer')
                .setPlaceholder('Choose a competitor to bet on...')
                .addOptions(
                    RACE_CONFIG.racers.map(racer => {
                        const emojiId = racer.emoji.match(/<a?:\w+:(\d+)>/)?.[1];
                        return {
                            label: racer.name,
                            value: racer.id,
                            emoji: emojiId ? { id: emojiId } : undefined,
                        }
                    })
                );
            return new ActionRowBuilder().addComponents(menu);
        };

        const reply = await interaction.editReply({ embeds: [generateBettingEmbed(RACE_CONFIG.betting_window / 1000)], components: [generateBettingComponents()] });
        
        const collector = reply.createMessageComponentCollector({ time: RACE_CONFIG.betting_window });
        const endTime = Date.now() + RACE_CONFIG.betting_window;

        const updateInterval = setInterval(() => {
            const timeLeft = Math.round((endTime - Date.now()) / 1000);
            if (timeLeft < 0) {
                clearInterval(updateInterval);
                return;
            }
            interaction.editReply({ embeds: [generateBettingEmbed(timeLeft)] }).catch(() => {});
        }, 5000);

        collector.on('collect', async i => {
            if (i.isStringSelectMenu()) {
                const racerId = i.values[0];
                const racerName = RACE_CONFIG.racers.find(r => r.id === racerId).name;
                const modal = new ModalBuilder()
                    .setCustomId(`bet_modal_${racerId}_${i.id}`)
                    .setTitle(`Bet on ${racerName}`);
                
                const amountInput = new TextInputBuilder()
                    .setCustomId('bet_amount')
                    .setLabel(`Amount of CHIPS (between ${RACE_CONFIG.min_bet} and ${RACE_CONFIG.max_bet})`)
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                modal.addComponents(new ActionRowBuilder().addComponents(amountInput));
                await i.showModal(modal);

                try {
                    const modalSubmit = await i.awaitModalSubmit({ filter: mi => mi.user.id === i.user.id && mi.customId === `bet_modal_${racerId}_${i.id}`, time: 60000 });
                    const betAmount = parseInt(modalSubmit.fields.getTextInputValue('bet_amount'));
                    
                    const userProfile = await Profile.findOne({ userId: i.user.id, guildId: interaction.guild.id });

                    if (isNaN(betAmount) || betAmount < RACE_CONFIG.min_bet || betAmount > RACE_CONFIG.max_bet) {
                        return modalSubmit.reply({ content: `Invalid bet. It must be a number between ${RACE_CONFIG.min_bet} and ${RACE_CONFIG.max_bet}.`, ephemeral: true });
                    }
                    // --- CHANGE: Check CHIPS ---
                    if (!userProfile || userProfile.chips < betAmount) {
                        return modalSubmit.reply({ content: `You do not have enough chips for that bet. You have **${userProfile?.chips.toLocaleString() || 0}** ${EMOJIS.chips.text}.`, ephemeral: true });
                    }
                    
                    if (bets.has(i.user.id)) {
                        const oldBet = bets.get(i.user.id);
                        await Profile.findOneAndUpdate({ userId: i.user.id, guildId: interaction.guild.id }, { $inc: { chips: oldBet.amount } });
                    }

                    // --- CHANGE: Use CHIPS ---
                    await Profile.findOneAndUpdate({ userId: i.user.id, guildId: interaction.guild.id }, { $inc: { chips: -betAmount } });
                    bets.set(i.user.id, { amount: betAmount, racerId: racerId });
                    await modalSubmit.reply({ content: `Your bet of **${betAmount.toLocaleString()}** chips on ${racerName} has been accepted!`, ephemeral: true });

                } catch (err) {
                    // User did not submit the modal in time
                }
            }
        });

        collector.on('end', async () => {
            clearInterval(updateInterval);
            gameState = 'racing';
            await interaction.editReply({ content: 'Betting is closed! The race begins!', embeds: [], components: [] });

            const racers = RACE_CONFIG.racers.map(r => ({ ...r, progress: 0 }));
            const raceInterval = setInterval(async () => {
                let winner = null;
                
                for (const racer of racers) {
                    let advance = 0;
                    const randomEvent = Math.random();
                    if (randomEvent < 0.6) advance = 1;
                    else if (randomEvent < 0.9) advance = 2;
                    
                    racer.progress += advance;
                    if (racer.progress >= RACE_CONFIG.track_length) {
                        winner = racer;
                        break;
                    }
                }

                const raceEmbed = new EmbedBuilder()
                    .setColor(0xF1C40F)
                    .setTitle('🏁 The Race is On! 🏁')
                    .setDescription(racers.map(r => {
                        const currentProgress = Math.min(r.progress, RACE_CONFIG.track_length);
                        const track = (EMOJIS.road_safe?.text || '─').repeat(currentProgress) + r.emoji + (EMOJIS.road_empty?.text || '─').repeat(RACE_CONFIG.track_length - currentProgress);
                        return `**${r.name}:**\n${track}`;
                    }).join('\n\n'));

                await interaction.editReply({ embeds: [raceEmbed] });

                if (winner) {
                    clearInterval(raceInterval);
                    const winningBets = Array.from(bets.entries()).filter(([, bet]) => bet.racerId === winner.id);
                    
                    const finalEmbed = new EmbedBuilder()
                        .setColor(winner.color)
                        .setTitle(`🏆 ${winner.name} has won the race! 🏆`)
                        .setThumbnail('https://media.discordapp.net/attachments/1354187398950682684/1412122875028181182/win.png?ex=68b72569&is=68b5d3e9&hm=bcf5bdfd30beaf4c1c39cf350e240703e872b28ae16c75ebeffb27bff04efa63&=&format=webp&quality=lossless&width=960&height=960');
                    
                    if (winningBets.length > 0) {
                        const winnersList = [];
                        const promises = winningBets.map(async ([userId, bet]) => {
                            const winnings = Math.floor(bet.amount * RACE_CONFIG.payout_multiplier);
                            winnersList.push(`<@${userId}> wins **${winnings.toLocaleString()}**`);
                            // --- CHANGE: Use CHIPS and add winnings + original bet ---
                            return Profile.findOneAndUpdate({ userId, guildId: interaction.guild.id }, { $inc: { chips: winnings + bet.amount } });
                        });
                        await Promise.all(promises);
                        finalEmbed.setDescription(`Congratulations to the winners!\n\n${winnersList.join('\n')}`);
                    } else {
                        finalEmbed.setDescription('No one bet on the champion this time! The house keeps the bets.');
                    }
                    await interaction.followUp({ embeds: [finalEmbed] });
                }
            }, 3000);
        });
    },
};

