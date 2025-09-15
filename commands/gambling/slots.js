// commands/gambling/slots.js

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const Profile = require('../../models/Profile');
const { SLOT_MACHINES, EMOJIS } = require('../../gameConfig');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('slots')
        .setDescription('Play the casino slot machines.'),

    async execute(interaction) {
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;
        
        await interaction.deferReply();

        let userProfile = await Profile.findOne({ userId, guildId });

        if (!userProfile) {
            return interaction.editReply({ content: 'You need a profile first. Use `/profile` to get started.', ephemeral: true });
        }

        let selectedMachine = null;

        const generateWelcomeEmbed = () => {
            return new EmbedBuilder()
                .setColor(0xFFD700)
                .setTitle('Welcome to the Slot Machine Hall')
                .setDescription('Choose one of our exclusive machines to try your luck. Each has its own bets and prizes.')
                .setThumbnail('https://i.imgur.com/E1h08v2.png');
        };

        const generateWelcomeComponents = () => {
            const menu = new StringSelectMenuBuilder()
                .setCustomId('select_slot_machine')
                .setPlaceholder('Select your machine...')
                .addOptions(
                    Object.entries(SLOT_MACHINES).map(([key, machine]) => ({
                        label: machine.name,
                        description: `Cost per spin: ${machine.cost} chips`, // CHANGE: chips
                        value: key,
                    }))
                );
            return new ActionRowBuilder().addComponents(menu);
        };

        const spin = (machine) => {
            const reels = machine.reels;
            const result = [];
            for (let i = 0; i < 3; i++) {
                const row = [];
                for (let j = 0; j < 3; j++) {
                    row.push(reels[j][Math.floor(Math.random() * reels[j].length)]);
                }
                result.push(row);
            }
            return result;
        };

        const calculateWinnings = (machine, grid) => {
            let totalWinnings = 0;
            const winningLines = [];

            // Horizontals
            for (let i = 0; i < 3; i++) {
                if (grid[i][0] === grid[i][1] && grid[i][1] === grid[i][2]) {
                    winningLines.push({ symbol: grid[i][0], line: `row ${i + 1}` });
                }
            }
            // Verticals
            for (let j = 0; j < 3; j++) {
                 if (grid[0][j] === grid[1][j] && grid[1][j] === grid[2][j]) {
                    winningLines.push({ symbol: grid[0][j], line: `column ${j + 1}` });
                }
            }
            // Diagonals
            if (grid[0][0] === grid[1][1] && grid[1][1] === grid[2][2]) {
                winningLines.push({ symbol: grid[0][0], line: 'diagonal' });
            }
            if (grid[0][2] === grid[1][1] && grid[1][1] === grid[2][0]) {
                winningLines.push({ symbol: grid[0][2], line: 'diagonal' });
            }
            
            if (winningLines.length === 0) return { totalWinnings: 0, isJackpot: false };

            let isJackpot = false;
            for (const line of winningLines) {
                let multiplier = machine.payouts[line.symbol] || 0;
                if (line.symbol === machine.jackpot.symbol) {
                    multiplier = machine.jackpot.multiplier;
                    isJackpot = true;
                }
                totalWinnings += machine.cost * multiplier;
            }
            
            return { totalWinnings, isJackpot };
        };
        
        const runGame = async (machineKey) => {
            selectedMachine = SLOT_MACHINES[machineKey];
            userProfile = await Profile.findOne({ userId, guildId });

            // --- CHANGE: Check CHIPS ---
            if (userProfile.chips < selectedMachine.cost) {
                await interaction.editReply({ content: `You do not have enough chips to play on this machine. You need **${selectedMachine.cost}** ${EMOJIS.chips.text}`, embeds: [], components: [] });
                return collector.stop();
            }

            // --- CHANGE: Use CHIPS ---
            await Profile.findOneAndUpdate({userId, guildId}, {$inc: {chips: -selectedMachine.cost}});

            const spinningEmbed = new EmbedBuilder()
                .setColor(0xFEE75C)
                .setTitle(`Spinning the ${selectedMachine.name}...`)
                .setDescription('The reels are spinning!\n\n**[ ❓ | ❓ | ❓ ]**\n**[ ❓ | ❓ | ❓ ]**\n**[ ❓ | ❓ | ❓ ]**')
                .setFooter({ text: `Cost per spin: ${selectedMachine.cost} chips` });

            await interaction.editReply({ embeds: [spinningEmbed], components: [] });

            setTimeout(async () => {
                const finalGrid = spin(selectedMachine);
                const { totalWinnings, isJackpot } = calculateWinnings(selectedMachine, finalGrid);
                
                // --- CHANGE: Use CHIPS and update stats ---
                await Profile.findOneAndUpdate({userId, guildId}, {$inc: {chips: totalWinnings, 'slotsStats.totalWinnings': totalWinnings }});

                const gridText = finalGrid.map(row => `**[ ${row.join(' | ')} ]**`).join('\n');
                const resultEmbed = new EmbedBuilder()
                    .setTitle(`${selectedMachine.name}'s result`)
                    .setDescription(gridText);
                
                if (isJackpot) {
                    resultEmbed.setColor(0xFFD700).addFields({ name: 'JACKPOT!', value: `You hit the jackpot and won **${totalWinnings.toLocaleString()}** ${EMOJIS.chips.text}` });
                } else if (totalWinnings > 0) {
                    resultEmbed.setColor(0x57F287).addFields({ name: 'Winner!', value: `You won **${totalWinnings.toLocaleString()}** ${EMOJIS.chips.text}` });
                } else {
                    resultEmbed.setColor(0xED4245).addFields({ name: 'Better luck next time!', value: 'No winning lines were found.' });
                }
                
                const finalProfile = await Profile.findOne({ userId, guildId });
                resultEmbed.addFields({ name: 'Current Chips', value: `${EMOJIS.chips.text} **${finalProfile.chips.toLocaleString()}**` });

                const playAgainButton = new ButtonBuilder().setCustomId('play_again').setLabel('Spin Again').setStyle(ButtonStyle.Primary);
                const changeMachineButton = new ButtonBuilder().setCustomId('change_machine').setLabel('Change Machine').setStyle(ButtonStyle.Secondary);
                const row = new ActionRowBuilder().addComponents(playAgainButton, changeMachineButton);

                await interaction.editReply({ embeds: [resultEmbed], components: [row] });

            }, 2500);
        };

        const reply = await interaction.editReply({ embeds: [generateWelcomeEmbed()], components: [generateWelcomeComponents()] });
        const collector = reply.createMessageComponentCollector({ filter: i => i.user.id === interaction.user.id, time: 180000 });

        collector.on('collect', async i => {
            await i.deferUpdate();

            if (i.isStringSelectMenu()) {
                const machineKey = i.values[0];
                runGame(machineKey);
            }

            if (i.isButton()) {
                if (i.customId === 'play_again') {
                    const machineKey = Object.keys(SLOT_MACHINES).find(key => SLOT_MACHINES[key].name === selectedMachine.name);
                    runGame(machineKey);
                }
                if (i.customId === 'change_machine') {
                    await interaction.editReply({ embeds: [generateWelcomeEmbed()], components: [generateWelcomeComponents()] });
                }
            }
        });

        collector.on('end', (collected, reason) => {
            if (reason === 'time') {
                interaction.editReply({ content: 'The game session has expired.', components: [], embeds: [] }).catch(() => {});
            }
        });
    },
};
