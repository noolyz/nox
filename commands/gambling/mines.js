// commands/gambling/mines.js

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Profile = require('../../models/Profile');
const { MINES_CONFIG, EMOJIS } = require('../../gameConfig');

const MIN_BET = 100;
const MAX_BET = 1000000;
const BET_ADJUSTMENTS = [100, 1000, 10000];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mines')
        .setDescription('A high-risk game. Discover gems and avoid mines to win.')
        .addIntegerOption(option => option.setName('bet').setDescription(`The amount of CHIPS to bet (between ${MIN_BET} and ${MAX_BET}).`).setRequired(true)),

    async execute(interaction) {
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;
        let initialBet = interaction.options.getInteger('bet');

        let userProfile = await Profile.findOne({ userId, guildId });
        if (!userProfile) return interaction.reply({ content: 'You need a profile first.', ephemeral: true });
        if (initialBet < MIN_BET || initialBet > MAX_BET) return interaction.reply({ content: `The bet must be between **${MIN_BET}** and **${MAX_BET}** chips.`, ephemeral: true });
        // --- CHANGE: Check CHIPS ---
        if (initialBet > userProfile.chips) return interaction.reply({ content: `You do not have enough chips. You have **${userProfile.chips.toLocaleString()}** ${EMOJIS.chips.text}.`, ephemeral: true });

        await interaction.deferReply();

        let gameState = 'choosing_grid';
        let gridSize, mineCount, gameBoard, revealedTiles, gemsFound;
        let currentBet = initialBet;
        let savedGridSize, savedMineCount;
        let collector;

        const startGame = async (bet) => {
            gameState = 'playing';
            userProfile = await Profile.findOne({ userId, guildId });
            if (bet > userProfile.chips) {
                await interaction.editReply({ content: 'You do not have enough funds for this bet. The game is cancelled.', embeds: [], components: [] });
                return collector.stop();
            }
            // --- CHANGE: Use CHIPS ---
            await Profile.findOneAndUpdate({ userId, guildId }, { $inc: { chips: -bet } });

            revealedTiles = Array(gridSize * gridSize).fill(false);
            gemsFound = 0;
            gameBoard = null;
            
            await interaction.editReply(generateUI());
            collector.resetTimer({ time: 180000 });
        };

        const runGameConfiguration = async () => {
            gameState = 'choosing_grid';
            await interaction.editReply(generateUI());
            collector.resetTimer({ time: 60000 });
        };

        const generateUI = () => {
            let embed, components = [];

            if (gameState === 'choosing_grid' || gameState === 'choosing_mines') {
                embed = new EmbedBuilder().setColor(0x5865F2).setTitle(`Game Configuration (Step ${gameState === 'choosing_grid' ? 1 : 2}/2)`);
                if (gameState === 'choosing_grid') {
                    embed.setDescription('Choose the size of the minefield.');
                    components.push(new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('grid_3x3').setLabel('3x3').setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId('grid_4x4').setLabel('4x4').setStyle(ButtonStyle.Primary)
                    ));
                } else {
                    embed.setDescription(`Field of **${gridSize}x${gridSize}** selected. Now, choose how many mines you want to hide.`);
                    const mineOptions = gridSize === 3 ? [1, 2, 3, 4, 5] : [2, 4, 6, 8];
                    const row = new ActionRowBuilder();
                    mineOptions.forEach(num => row.addComponents(new ButtonBuilder().setCustomId(`mines_${num}`).setLabel(`${num} Mines`).setStyle(ButtonStyle.Secondary)));
                    components.push(row, new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('back_to_grid_choice').setLabel('Back').setStyle(ButtonStyle.Danger)));
                }
            } else if (gameState === 'playing' || gameState === 'ended') {
                const isGameOver = gameState === 'ended';
                const currentMultiplier = MINES_CONFIG.getMultiplier(gridSize, mineCount, gemsFound);
                const potentialWinnings = Math.floor(currentBet * currentMultiplier);

                embed = new EmbedBuilder()
                    .setColor(isGameOver ? (gemsFound > 0 ? 0x57F287 : 0xED4245) : 0x5865F2)
                    .setTitle('Mines')
                    .addFields(
                        { name: 'Gems Found', value: `${EMOJIS.diamond_purple.text} ${gemsFound}`, inline: true },
                        { name: 'Hidden Mines', value: `${EMOJIS.bomb.text} ${mineCount}`, inline: true },
                        { name: 'Multiplier', value: `x${currentMultiplier.toFixed(2)}`, inline: true },
                        { name: 'Winnings', value: `${EMOJIS.chips.text} **${potentialWinnings.toLocaleString()}**`, inline: true },
                        { name: 'Next Multiplier', value: `x${MINES_CONFIG.getMultiplier(gridSize, mineCount, gemsFound + 1).toFixed(2)}`, inline: true },
                        { name: 'Bet', value: `${currentBet.toLocaleString()}`, inline: true }
                    );

                for (let i = 0; i < gridSize; i++) {
                    const row = new ActionRowBuilder();
                    for (let j = 0; j < gridSize; j++) {
                        const index = i * gridSize + j;
                        const button = new ButtonBuilder().setCustomId(`mine_${index}`);
                        if (isGameOver) {
                            button.setDisabled(true)
                                .setEmoji(gameBoard[index] === 'gem' ? EMOJIS.diamond_purple.id : EMOJIS.bomb.id)
                                .setStyle(revealedTiles[index] ? (gameBoard[index] === 'gem' ? ButtonStyle.Success : ButtonStyle.Danger) : ButtonStyle.Secondary);
                        } else {
                            button.setDisabled(revealedTiles[index]);
                            if (revealedTiles[index]) {
                                button.setEmoji(EMOJIS.diamond_purple.id).setStyle(ButtonStyle.Success);
                            } else {
                                button.setLabel('❓').setStyle(ButtonStyle.Secondary);
                            }
                        }
                        row.addComponents(button);
                    }
                    components.push(row);
                }
                if (!isGameOver) {
                    components.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('cashout').setLabel(`Cash Out`).setEmoji(EMOJIS.cash.id).setStyle(ButtonStyle.Success).setDisabled(gemsFound === 0)));
                } else {
                    // --- FIX: Implement new button system ---
                     components.push(new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('repeat_bet_mines').setLabel('Repeat Bet').setEmoji(EMOJIS.refresh.id).setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId('change_bet_mines').setLabel('Change Bet').setEmoji(EMOJIS.change.id).setStyle(ButtonStyle.Primary)
                    ));
                }
            } else if (gameState === 'betting') {
                embed = new EmbedBuilder().setColor(0x5865F2).setTitle('New Game').setDescription(`Your last bet was **${initialBet.toLocaleString()}** ${EMOJIS.chips.text}`).addFields({ name: 'Current Bet', value: `${EMOJIS.chips.text} **${currentBet.toLocaleString()}**` });
                const row1 = new ActionRowBuilder();
                BET_ADJUSTMENTS.forEach(amount => row1.addComponents(new ButtonBuilder().setCustomId(`decrease_${amount}`).setLabel(`-${amount}`).setStyle(ButtonStyle.Danger)));
                const row2 = new ActionRowBuilder();
                BET_ADJUSTMENTS.forEach(amount => row2.addComponents(new ButtonBuilder().setCustomId(`increase_${amount}`).setLabel(`+${amount}`).setStyle(ButtonStyle.Success)));
                const row3 = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('start_new_bet_mines').setLabel(`Bet ${currentBet.toLocaleString()}`).setStyle(ButtonStyle.Primary));
                components = [row1, row2, row3];
            }
            return { embeds: [embed], components };
        };

        const reply = await interaction.editReply(generateUI());
        collector = reply.createMessageComponentCollector({ filter: i => i.user.id === userId, time: 180000 });

        collector.on('collect', async i => {
            await i.deferUpdate();
            userProfile = await Profile.findOne({ userId, guildId });
            
            if (gameState === 'choosing_grid' || gameState === 'choosing_mines') {
                if (i.customId.startsWith('grid_')) {
                    gridSize = parseInt(i.customId.split('_')[1][0]);
                    gameState = 'choosing_mines';
                } else if (i.customId === 'back_to_grid_choice') {
                    gameState = 'choosing_grid';
                } else if (i.customId.startsWith('mines_')) {
                    mineCount = parseInt(i.customId.split('_')[1]);
                    savedGridSize = gridSize; // Save config for play again
                    savedMineCount = mineCount;
                    await startGame(currentBet);
                    return;
                }
                await interaction.editReply(generateUI());
                collector.resetTimer();

            } else if (gameState === 'playing') {
                if (i.customId === 'cashout') {
                    const winnings = Math.floor(currentBet * MINES_CONFIG.getMultiplier(gridSize, mineCount, gemsFound));
                    await Profile.findOneAndUpdate({userId, guildId}, {$inc: {chips: winnings, 'minesStats.totalWinnings': (winnings - currentBet)}});
                    gameState = 'ended';
                    const ui = generateUI();
                    ui.embeds[0].setTitle(`${EMOJIS.check.text} Successful Cash Out`).setDescription(`You won **${(winnings - currentBet).toLocaleString()}** ${EMOJIS.chips.text} by cashing out!`);
                    await interaction.editReply(ui);
                } else if (i.customId.startsWith('mine_')) {
                    const index = parseInt(i.customId.split('_')[1]);
                    
                    if (!gameBoard) {
                        const totalTiles = gridSize * gridSize;
                        gameBoard = Array(totalTiles).fill('gem');
                        let minesPlaced = 0;
                        while (minesPlaced < mineCount) {
                            const randomIndex = Math.floor(Math.random() * totalTiles);
                            if (randomIndex !== index && gameBoard[randomIndex] === 'gem') {
                                gameBoard[randomIndex] = 'mine';
                                minesPlaced++;
                            }
                        }
                    }
                    revealedTiles[index] = true;

                    if (gameBoard[index] === 'mine') {
                        gameState = 'ended';
                        const ui = generateUI();
                        ui.embeds[0].setTitle(`${EMOJIS.bomb.text} BOOM!`).setDescription(`You hit a mine. You lost your bet.`);
                        await interaction.editReply(ui);
                    } else {
                        gemsFound++;
                        const totalTiles = gridSize * gridSize;
                        if (gemsFound === totalTiles - mineCount) {
                            const winnings = Math.floor(currentBet * MINES_CONFIG.getMultiplier(gridSize, mineCount, gemsFound));
                            await Profile.findOneAndUpdate({userId, guildId}, {$inc: {chips: winnings, 'minesStats.totalWinnings': (winnings - currentBet)}});
                            gameState = 'ended';
                            const ui = generateUI();
                            ui.embeds[0].setTitle(`${EMOJIS.trophy.text} FIELD CLEARED!`).setDescription(`Amazing! You found all the gems and won **${(winnings-currentBet).toLocaleString()}** ${EMOJIS.chips.text}`);
                            await interaction.editReply(ui);
                        } else {
                            await interaction.editReply(generateUI());
                        }
                    }
                }
            } else if (gameState === 'ended') {
                 if (i.customId === 'repeat_bet_mines') {
                    gridSize = savedGridSize;
                    mineCount = savedMineCount;
                    await startGame(currentBet);
                } else if (i.customId === 'change_bet_mines') {
                    gameState = 'betting';
                    await interaction.editReply(generateUI());
                }
            } else if (gameState === 'betting') {
                 if (i.customId.startsWith('decrease_')) currentBet = Math.max(MIN_BET, currentBet - parseInt(i.customId.split('_')[1]));
                 if (i.customId.startsWith('increase_')) currentBet = Math.min(MAX_BET, userProfile.chips, currentBet + parseInt(i.customId.split('_')[1]));
                
                if (i.customId === 'start_new_bet_mines') {
                    initialBet = currentBet;
                    gridSize = savedGridSize;
                    mineCount = savedMineCount;
                    await startGame(currentBet);
                } else {
                    await interaction.editReply(generateUI());
                }
            }
        });

        collector.on('end', async (collected, reason) => {
            if (reason === 'time' && gameState !== 'ended') {
                if (gameState === 'playing' && gemsFound > 0) {
                     const winnings = Math.floor(currentBet * MINES_CONFIG.getMultiplier(gridSize, mineCount, gemsFound));
                     await Profile.findOneAndUpdate({userId, guildId}, {$inc: {chips: winnings}});
                     const timeoutEmbed = new EmbedBuilder().setColor(0x57F287).setTitle(`${EMOJIS.warning.text} Automatic Cash Out`).setDescription(`The session has expired and you cashed out with **${(winnings - currentBet).toLocaleString()}** ${EMOJIS.chips.text}.`);
                     await interaction.editReply({ embeds: [timeoutEmbed], components: [] });
                } else {
                    const timeoutEmbed = new EmbedBuilder().setColor(0xED4245).setTitle(`${EMOJIS.warning.text} Session Expired`).setDescription('The game session has expired.');
                    await interaction.editReply({ embeds: [timeoutEmbed], components: [] });
                }
            }
        });
        
        await runGameConfiguration();
    },
};

