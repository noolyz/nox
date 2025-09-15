// commands/gambling/coinflip.js

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Profile = require('../../models/Profile');
const { EMOJIS } = require('../../gameConfig');

const MIN_BET = 10;
const MAX_BET = 50000;
const BET_ADJUSTMENTS = [100, 1000, 5000];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('coinflip')
        .setDescription('Flip a coin and bet chips to double your money.')
        .addStringOption(option =>
            option.setName('side')
                .setDescription('Choose heads or tails.')
                .setRequired(true)
                .addChoices(
                    { name: '🪙 Heads', value: 'heads' },
                    { name: '🪙 Tails', value: 'tails' }
                ))
        .addIntegerOption(option =>
            option.setName('bet')
                .setDescription(`The amount of chips to bet (between ${MIN_BET} and ${MAX_BET}).`)
                .setRequired(true)),

    async execute(interaction) {
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;
        const initialSide = interaction.options.getString('side');
        let initialBet = interaction.options.getInteger('bet');

        let userProfile = await Profile.findOne({ userId, guildId });
        if (!userProfile) {
            return interaction.reply({ content: 'You need a profile first.', ephemeral: true });
        }
        if (initialBet < MIN_BET || initialBet > MAX_BET) {
            return interaction.reply({ content: `The bet must be between **${MIN_BET}** and **${MAX_BET}** ${EMOJIS.chips.text}.`, ephemeral: true });
        }
        if (initialBet > userProfile.chips) {
            return interaction.reply({ content: `You don't have enough chips. You have **${userProfile.chips.toLocaleString()}** ${EMOJIS.chips.text}. Use \`/chips buy\` to get more.`, ephemeral: true });
        }

        await interaction.deferReply();

        let currentBet = initialBet;
        let currentSide = initialSide;
        let gameState = 'playing'; // playing, ended, betting

        const runGame = async (bet, side) => {
            userProfile = await Profile.findOne({ userId, guildId });
            if (bet > userProfile.chips) {
                await interaction.editReply({ content: 'You no longer have enough chips for this bet.', components: [] });
                return collector.stop();
            }

            await Profile.findOneAndUpdate({ userId, guildId }, { $inc: { chips: -bet } });

            const flipEmbed = new EmbedBuilder()
                .setColor(0xFEE75C)
                .setTitle(`${EMOJIS.coin.text} Flipping the Coin...`)
                .setDescription('The coin spins in the air...');
            await interaction.editReply({ embeds: [flipEmbed], components: [] });

            setTimeout(async () => {
                const result = Math.random() < 0.5 ? 'heads' : 'tails';
                const win = result === side;
                let winAmount = 0;

                const resultEmbed = new EmbedBuilder()
                    .setTitle(`It's **${result.toUpperCase()}**!`)
                    .setThumbnail(result === 'heads' ? 'https://i.imgur.com/s4d3a5g.png' : 'https://i.imgur.com/nI46s4B.png');
                
                if (win) {
                    winAmount = bet; // Net win is the bet amount
                    const totalReturn = bet * 2;
                    await Profile.findOneAndUpdate({ userId, guildId }, { $inc: { chips: totalReturn } });
                    resultEmbed
                        .setColor(0x57F287)
                        .setDescription(`Congratulations! You won **${winAmount.toLocaleString()}** ${EMOJIS.chips.text}`);
                } else {
                    resultEmbed
                        .setColor(0xED4245)
                        .setDescription(`Bad luck. You lost **${bet.toLocaleString()}** ${EMOJIS.chips.text}`);
                }

                const finalProfile = await Profile.findOne({ userId, guildId });
                resultEmbed.addFields({ name: 'Current Chips', value: `${EMOJIS.chips.text} **${finalProfile.chips.toLocaleString()}**` });
                
                gameState = 'ended';
                const components = generateComponents();
                await interaction.editReply({ embeds: [resultEmbed], components });
                collector.resetTimer({ time: 60000 });

            }, 2000);
        };

        const generateComponents = () => {
            if (gameState === 'ended') {
                return [new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('repeat_bet_cf').setLabel('Repeat Bet').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('change_bet_cf').setLabel('Change Bet').setStyle(ButtonStyle.Primary)
                )];
            }
            if (gameState === 'betting') {
                 const embed = new EmbedBuilder()
                    .setColor(0x5865F2)
                    .setTitle('New Bet')
                    .setDescription(`You chose **${currentSide}**. Adjust your new bet below.`)
                    .addFields({ name: 'Current Bet', value: `${EMOJIS.chips.text} **${currentBet.toLocaleString()}**` });

                const row1 = new ActionRowBuilder();
                BET_ADJUSTMENTS.forEach(amount => row1.addComponents(new ButtonBuilder().setCustomId(`decrease_${amount}`).setLabel(`-${amount}`).setStyle(ButtonStyle.Danger)));
                const row2 = new ActionRowBuilder();
                BET_ADJUSTMENTS.forEach(amount => row2.addComponents(new ButtonBuilder().setCustomId(`increase_${amount}`).setLabel(`+${amount}`).setStyle(ButtonStyle.Success)));
                const row3 = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('start_new_bet_cf').setLabel(`Bet ${currentBet.toLocaleString()}`).setStyle(ButtonStyle.Primary));
                
                return { embeds: [embed], components: [row1, row2, row3] };
            }
            return [];
        };

        const reply = await interaction.editReply({ content: 'Starting game...', components: [] });
        const collector = reply.createMessageComponentCollector({ filter: i => i.user.id === userId, time: 180000 });

        collector.on('collect', async i => {
            await i.deferUpdate();
            userProfile = await Profile.findOne({ userId, guildId });

            if (gameState === 'ended') {
                if (i.customId === 'repeat_bet_cf') {
                    currentBet = initialBet;
                    return runGame(currentBet, currentSide);
                } else if (i.customId === 'change_bet_cf') {
                    gameState = 'betting';
                    currentBet = initialBet;
                    const ui = generateComponents();
                    return interaction.editReply({ embeds: ui.embeds, components: ui.components });
                }
            } else if (gameState === 'betting') {
                if (i.customId.startsWith('decrease_')) {
                    const amount = parseInt(i.customId.split('_')[1]);
                    currentBet = Math.max(MIN_BET, currentBet - amount);
                }
                if (i.customId.startsWith('increase_')) {
                    const amount = parseInt(i.customId.split('_')[1]);
                    currentBet = Math.min(MAX_BET, userProfile.chips, currentBet + amount);
                }
                if (i.customId === 'start_new_bet_cf') {
                    initialBet = currentBet;
                    return runGame(initialBet, currentSide);
                }
                const ui = generateComponents();
                return interaction.editReply({ embeds: ui.embeds, components: ui.components });
            }
        });

        collector.on('end', (collected, reason) => {
            if (reason === 'time' && gameState !== 'ended') {
                interaction.editReply({ content: 'Coinflip session expired.', components: [] }).catch(() => {});
            } else if (gameState === 'ended') {
                 interaction.editReply({ components: [] }).catch(() => {});
            }
        });

        runGame(currentBet, currentSide);
    },
};
