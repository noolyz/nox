// commands/gambling/roulette.js

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder } = require('discord.js');
const Profile = require('../../models/Profile');
const { ROULETTE_CONFIG, EMOJIS } = require('../../gameConfig');

const MIN_BET = 100;
const MAX_BET = 250000;
const BET_ADJUSTMENTS = [1000, 10000, 50000];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('roulette')
        .setDescription('Play a sophisticated game of roulette with multiple betting options.')
        .addIntegerOption(option => option.setName('bet').setDescription(`The amount of chips to bet (between ${MIN_BET} and ${MAX_BET}).`).setRequired(true)),

    async execute(interaction) {
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;
        let initialBet = interaction.options.getInteger('bet');

        let userProfile = await Profile.findOne({ userId, guildId });
        if (!userProfile) return interaction.reply({ content: 'You need a profile first.', ephemeral: true });
        if (initialBet < MIN_BET || initialBet > MAX_BET) return interaction.reply({ content: `Your bet must be between **${MIN_BET}** and **${MAX_BET}** chips.`, ephemeral: true });
        if (initialBet > userProfile.chips) return interaction.reply({ content: `You do not have enough chips for that bet. You have **${userProfile.chips.toLocaleString()}**.`, ephemeral: true });

        await interaction.deferReply();
        
        let currentBet = initialBet;
        let bets = [];
        let gameState = 'betting';
        let currentSubMenu = null;
        let collector;

        const renderUI = async () => {
            const embed = new EmbedBuilder();
            const components = [];

            if (gameState === 'betting') {
                embed.setColor(0xC2185B)
                    .setTitle(`${EMOJIS.crupier.text} Roulette Table`)
                    .setDescription('Place your bets using the buttons below. You can place multiple bets before spinning.')
                    .setThumbnail('https://i.imgur.com/8c2r2d9.png')
                    .addFields({ name: 'Your Bet', value: `${EMOJIS.chips.text} **${currentBet.toLocaleString()}**` });
                
                let betSummary = bets.map(bet => {
                    let betDisplay = `${bet.value.charAt(0).toUpperCase() + bet.value.slice(1)}`;
                    if (bet.type === 'dozen') betDisplay = `${bet.value} Dozen`;
                    if (bet.type === 'column') betDisplay = `Column ${bet.value}`;
                    return `• **${bet.amount.toLocaleString()}** on ${betDisplay}`;
                }).join('\n') || 'No bets placed yet.';
                
                embed.addFields({ name: 'Current Bets', value: betSummary });

                components.push(
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('bet_outside').setLabel('Place Bet').setStyle(ButtonStyle.Secondary)
                    ),
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('spin').setLabel('Spin the Wheel').setEmoji('🔄').setStyle(ButtonStyle.Success).setDisabled(bets.length === 0),
                        new ButtonBuilder().setCustomId('leave').setLabel('Leave Table').setStyle(ButtonStyle.Danger)
                    )
                );
            } else if (gameState === 'betting_outside') {
                embed.setColor(0x7B1FA2)
                    .setTitle(`Placing an Outside Bet`)
                    .setDescription('Select the type of outside bet you want to place.');
                
                if (!currentSubMenu) {
                    components.push(
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('choice_color').setLabel('Color').setStyle(ButtonStyle.Primary),
                            new ButtonBuilder().setCustomId('choice_even_odd').setLabel('Even/Odd').setStyle(ButtonStyle.Primary),
                            new ButtonBuilder().setCustomId('choice_low_high').setLabel('Low/High').setStyle(ButtonStyle.Primary)
                        ),
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('choice_dozen').setLabel('Dozen').setStyle(ButtonStyle.Primary),
                            new ButtonBuilder().setCustomId('choice_column').setLabel('Column').setStyle(ButtonStyle.Primary)
                        ),
                        new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('back_to_main').setLabel('Back to Main Table').setStyle(ButtonStyle.Secondary))
                    );
                } else {
                    let options;
                    if (currentSubMenu === 'color') options = [{label:'Red', value:'red'}, {label:'Black', value:'black'}];
                    else if (currentSubMenu === 'even_odd') options = [{label:'Even', value:'even'}, {label:'Odd', value:'odd'}];
                    else if (currentSubMenu === 'low_high') options = [{label:'Low (1-18)', value:'low'}, {label:'High (19-36)', value:'high'}];
                    else if (currentSubMenu === 'dozen') options = [{label:'1st Dozen (1-12)', value:'1st'}, {label:'2nd Dozen (13-24)', value:'2nd'}, {label:'3rd Dozen (25-36)', value:'3rd'}];
                    else if (currentSubMenu === 'column') options = [{label:'1st Column', value:'1st'}, {label:'2nd Column', value:'2nd'}, {label:'3rd Column', value:'3rd'}];
                    
                    const menu = new StringSelectMenuBuilder().setCustomId(`select_${currentSubMenu}`).setPlaceholder(`Select an option...`).addOptions(options);
                    components.push(new ActionRowBuilder().addComponents(menu));
                    components.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('bet_outside').setLabel('Back to Bet Types').setStyle(ButtonStyle.Secondary)));
                }
            } else if (gameState === 'betting_again') {
                 embed.setColor(0x5865F2).setTitle('New Bet').setDescription(`Your last bet was **${initialBet.toLocaleString()}** chips.`).addFields({ name: 'Current Bet', value: `${EMOJIS.chips.text} **${currentBet.toLocaleString()}**` });
                const row1 = new ActionRowBuilder();
                BET_ADJUSTMENTS.forEach(amount => row1.addComponents(new ButtonBuilder().setCustomId(`decrease_${amount}`).setLabel(`-${amount}`).setStyle(ButtonStyle.Danger)));
                const row2 = new ActionRowBuilder();
                BET_ADJUSTMENTS.forEach(amount => row2.addComponents(new ButtonBuilder().setCustomId(`increase_${amount}`).setLabel(`+${amount}`).setStyle(ButtonStyle.Success)));
                const row3 = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('start_new_bet').setLabel(`Bet ${currentBet.toLocaleString()}`).setStyle(ButtonStyle.Primary));
                components.push(row1, row2, row3);
            }
            
            if (!embed.data.title && !embed.data.description && (!embed.data.fields || embed.data.fields.length === 0)) {
                embed.setDescription('\u200B');
            }

            await interaction.editReply({ embeds: [embed], components });
        };

        const placeBet = async (i, type, value) => {
             const modal = new ModalBuilder().setCustomId(`bet_amount_modal_${i.id}`).setTitle(`Bet on ${value}`);
             const amountInput = new TextInputBuilder().setCustomId('bet_amount_input').setLabel(`Amount to bet (You have: ${userProfile.chips.toLocaleString()})`).setStyle(TextInputStyle.Short).setRequired(true);
             modal.addComponents(new ActionRowBuilder().addComponents(amountInput));
             await i.showModal(modal);

             const modalSubmit = await i.awaitModalSubmit({ filter: mi => mi.user.id === i.user.id, time: 60000 }).catch(() => null);
             if (!modalSubmit) return;

             const amount = parseInt(modalSubmit.fields.getTextInputValue('bet_amount_input'));
             if (isNaN(amount) || amount <= 0 || amount > userProfile.chips) {
                return modalSubmit.reply({ content: 'Invalid amount.', ephemeral: true });
             }
             
             const existingBet = bets.find(b => b.type === type && b.value === value);
             if (existingBet) {
                 existingBet.amount += amount;
             } else {
                 bets.push({ type, value, amount });
             }
             
             // We don't change chips here, only when spinning
             gameState = 'betting';
             currentSubMenu = null;
             await modalSubmit.deferUpdate();
        };

        const startSpin = async () => {
            const totalBetAmount = bets.reduce((sum, bet) => sum + bet.amount, 0);
            userProfile = await Profile.findOne({ userId, guildId });
            if(totalBetAmount > userProfile.chips) {
                await interaction.editReply({content: 'You no longer have enough chips for your combined bets.', embeds: [], components: []});
                return collector.stop();
            }
            await Profile.findOneAndUpdate({ userId, guildId }, { $inc: { chips: -totalBetAmount } });

            gameState = 'spinning';
            const spinAnimationEmbed = new EmbedBuilder().setColor(0x2ECC71).setTitle('No more bets! The ball is spinning...');
            await interaction.editReply({ embeds: [spinAnimationEmbed], components: [] });

            const spinDuration = 5;
            let spinCount = 0;
            const spinInterval = setInterval(async () => {
                spinCount++;
                const randomNumber = ROULETTE_CONFIG.wheel[Math.floor(Math.random() * ROULETTE_CONFIG.wheel.length)];
                spinAnimationEmbed.setDescription(`**... ${randomNumber} ...**`);
                await interaction.editReply({ embeds: [spinAnimationEmbed] }).catch(()=>{});

                if (spinCount >= spinDuration) {
                    clearInterval(spinInterval);
                    const winningNumber = ROULETTE_CONFIG.wheel[Math.floor(Math.random() * ROULETTE_CONFIG.wheel.length)];
                    const winningColor = ROULETTE_CONFIG.colors.red.includes(winningNumber) ? 'red' : (ROULETTE_CONFIG.colors.black.includes(winningNumber) ? 'black' : 'green');
                    let totalPayout = 0;
                    let resultDescription = `The ball landed on **${winningNumber} ${winningColor.charAt(0).toUpperCase() + winningColor.slice(1)}**!\n\n**Your Bets:**\n`;
                    bets.forEach(bet => {
                        let win = false;
                        let payoutMultiplier = 0;
                        let betDisplay = `${bet.value.charAt(0).toUpperCase() + bet.value.slice(1)}`;

                        if (bet.type === 'color' && bet.value === winningColor) { win = true; payoutMultiplier = ROULETTE_CONFIG.payouts.color; }
                        else if (bet.type === 'even_odd' && winningNumber !== 0 && ((bet.value === 'even' && winningNumber % 2 === 0) || (bet.value === 'odd' && winningNumber % 2 !== 0))) { win = true; payoutMultiplier = ROULETTE_CONFIG.payouts.even_odd; }
                        else if (bet.type === 'low_high' && winningNumber !== 0 && ((bet.value === 'low' && winningNumber <= 18) || (bet.value === 'high' && winningNumber >= 19))) { win = true; payoutMultiplier = ROULETTE_CONFIG.payouts.low_high; }
                        else if (bet.type === 'dozen') { win = true; payoutMultiplier = ROULETTE_CONFIG.payouts.dozen; betDisplay = `${bet.value} Dozen`; if (!((bet.value === '1st' && winningNumber <= 12) || (bet.value === '2nd' && winningNumber > 12 && winningNumber <= 24) || (bet.value === '3rd' && winningNumber > 24))) win = false; }
                        else if (bet.type === 'column') { win = true; payoutMultiplier = ROULETTE_CONFIG.payouts.column; betDisplay = `Column ${bet.value}`; if (!ROULETTE_CONFIG.columns[bet.value].includes(winningNumber)) win = false; }
                        
                        if (win) {
                            const winnings = Math.floor(bet.amount * payoutMultiplier);
                            totalPayout += bet.amount + winnings;
                            resultDescription += `✅ **${bet.amount.toLocaleString()}** on ${betDisplay} - Won **${winnings.toLocaleString()}**\n`;
                        } else {
                            resultDescription += `❌ **${bet.amount.toLocaleString()}** on ${betDisplay} - Lost\n`;
                        }
                    });
                    const betTotal = bets.reduce((acc, bet) => acc + bet.amount, 0);
                    const netResult = totalPayout - betTotal;
                    
                    const resultEmbed = new EmbedBuilder().setDescription(resultDescription);
                    if (netResult >= 0) resultEmbed.setColor(0x57F287).setTitle(`You Won ${netResult.toLocaleString()} Chips!`);
                    else resultEmbed.setColor(0xED4245).setTitle(`You Lost ${Math.abs(netResult).toLocaleString()} Chips`);
                    
                    const finalProfile = await Profile.findOneAndUpdate({userId, guildId}, {$inc: {chips: totalPayout}}, {new: true});
                    resultEmbed.addFields({ name: 'Current Chips', value: `${EMOJIS.chips.text} **${finalProfile.chips.toLocaleString()}**` });

                    gameState = 'ended';
                    const playAgainRow = new ActionRowBuilder().addComponents( 
                        new ButtonBuilder().setCustomId('play_again_roulette').setLabel('Play Again').setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId('change_bet_roulette').setLabel('Change Bet').setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId('leave_roulette').setLabel('Leave Table').setStyle(ButtonStyle.Danger)
                    );
                    await interaction.editReply({ embeds: [resultEmbed], components: [playAgainRow] });
                }
            }, 1000);
        };
        
        const reply = await interaction.editReply({ content: 'Loading table...', embeds: [], components: [] });
        collector = reply.createMessageComponentCollector({ filter: i => i.user.id === userId, time: 300000 });
        
        collector.on('collect', async i => {
            try {
                if (i.isModalSubmit()) return;

                if (i.isStringSelectMenu()) {
                    const type = i.customId.replace('select_', '');
                    const value = i.values[0];
                    await placeBet(i, type, value);
                } else if (i.isButton()) {
                    if (i.customId === 'back_to_main') { await i.deferUpdate(); gameState = 'betting'; currentSubMenu = null; }
                    else if (i.customId === 'bet_outside') { await i.deferUpdate(); gameState = 'betting_outside'; currentSubMenu = null; }
                    else if (i.customId === 'spin') { await i.deferUpdate(); await startSpin(); return; }
                    else if (i.customId === 'leave_roulette') {
                        await i.deferUpdate();
                        const finalEmbed = new EmbedBuilder().setColor(0x99AAB5).setTitle('You left the table.').setDescription(`Thanks for playing!`);
                        await interaction.editReply({ embeds: [finalEmbed], components: [] });
                        return collector.stop('user_leave');
                    } else if (i.customId === 'play_again_roulette') {
                        await i.deferUpdate();
                        userProfile = await Profile.findOne({userId, guildId});
                        const totalLastBet = bets.reduce((sum, bet) => sum + bet.amount, 0);
                        if (userProfile.chips < totalLastBet) {
                             const noChipsEmbed = new EmbedBuilder().setColor(0xED4245).setTitle('Not Enough Chips').setDescription(`You don't have enough chips to repeat your bets.`);
                             await interaction.editReply({ embeds: [noChipsEmbed], components: [] });
                             return collector.stop('no_chips');
                        }
                        await startSpin();
                    } else if (i.customId === 'change_bet_roulette') {
                        await i.deferUpdate();
                        userProfile = await Profile.findOne({userId, guildId});
                         if (userProfile.chips < MIN_BET) {
                             const noChipsEmbed = new EmbedBuilder().setColor(0xED4245).setTitle('Not Enough Chips').setDescription(`You need at least **${MIN_BET}** to play again.`);
                             await interaction.editReply({ embeds: [noChipsEmbed], components: [] });
                             return collector.stop('no_chips');
                        }
                        bets = [];
                        gameState = 'betting';
                    } else if (i.customId.startsWith('choice_')) {
                        await i.deferUpdate();
                        currentSubMenu = i.customId.replace('choice_', '');
                    }
                }
                
                await renderUI();
                collector.resetTimer();
            } catch (error) {
                console.error('Error in roulette collector:', error);
            }
        });

        collector.on('end', async (collected, reason) => {
            if (!['user_leave', 'no_chips'].includes(reason)) {
                await interaction.editReply({ content: 'The roulette session has expired.', embeds: [], components: [] }).catch(() => {});
            }
        });
        
        await renderUI();
    },
};

