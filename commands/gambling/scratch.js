// commands/gambling/scratch.js

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Profile = require('../../models/Profile');
const { SCRATCH_TICKETS, EMOJIS } = require('../../gameConfig');

// --- HELPER FUNCTIONS ---

// Muestra la pantalla de bienvenida/tienda y adjunta un colector para la selección.
async function presentStore(interaction, userProfile) {
    const welcomeEmbed = new EmbedBuilder()
        .setColor(0xAF01D1)
        .setTitle(`Tienda de Rasca y Gana`)
        .setDescription(`¡Bienvenido! Elige el cartón que te llevará a la gloria.\nTienes **${userProfile.chips.toLocaleString()}** ${EMOJIS.chips.text} disponibles.`)
        .setThumbnail('https://i.imgur.com/L4w8u22.png');

    const menuOptions = Object.entries(SCRATCH_TICKETS).map(([key, ticket]) => {
        welcomeEmbed.addFields({
            name: `${ticket.name}`,
            value: `Costo: **${ticket.cost.toLocaleString()}** ${EMOJIS.chips.text}\nPremio Mayor: **${(ticket.cost * Object.values(ticket.payouts).sort((a, b) => b - a)[0]).toLocaleString()}** ${EMOJIS.chips.text}`,
            inline: true,
        });
        return { label: ticket.name, description: `Costo: ${ticket.cost.toLocaleString()} fichas`, value: key };
    });

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('scratch_ticket_select')
        .setPlaceholder('Selecciona un cartón para comprar...')
        .addOptions(menuOptions);

    const row = new ActionRowBuilder().addComponents(selectMenu);
    const payload = { embeds: [welcomeEmbed], components: [row], content: ' ', fetchReply: true };

    const reply = await (interaction.isButton() || interaction.isStringSelectMenu() ? interaction.update(payload) : interaction.editReply(payload));

    const collector = reply.createMessageComponentCollector({ filter: i => i.user.id === interaction.user.id, time: 60000, max: 1 });

    collector.on('collect', async i => {
        if (i.isStringSelectMenu() && i.customId === 'scratch_ticket_select') {
            const ticketKey = i.values[0];
            await runGame(i, ticketKey);
        }
    });

    collector.on('end', (collected, reason) => {
        if (reason === 'time' && collected.size === 0) {
            interaction.editReply({ content: 'La sesión de compra ha expirado.', embeds: [], components: [] }).catch(() => {});
        }
    });
}


// Inicia una partida de Rasca y Gana
async function runGame(interaction, ticketKey) {
    const userId = interaction.user.id;
    const guildId = interaction.guild.id;
    const selectedTicket = SCRATCH_TICKETS[ticketKey];

    let userProfile = await Profile.findOne({ userId, guildId });

    if (userProfile.chips < selectedTicket.cost) {
        return await interaction.update({ content: `No tienes suficientes fichas para comprar el **${selectedTicket.name}**. Necesitas **${selectedTicket.cost.toLocaleString()}** ${EMOJIS.chips.text}.`, embeds: [], components: [] });
    }

    await Profile.findOneAndUpdate({ userId, guildId }, { $inc: { chips: -selectedTicket.cost } });

    const weightedSymbols = [];
    selectedTicket.symbols.forEach(s => { for (let i = 0; i < s.weight; i++) weightedSymbols.push(s.symbol); });

    const finalGrid = Array.from({ length: selectedTicket.gridSize }, () => weightedSymbols[Math.floor(Math.random() * weightedSymbols.length)]);

    const gameEmbed = new EmbedBuilder()
        .setColor(0xFAA61A)
        .setTitle(selectedTicket.name)
        .setDescription('¡Combina 3 símbolos para ganar!\n_Haz clic en los cuadros para rascar._')
        .setFooter({ text: `Costo: ${selectedTicket.cost.toLocaleString()} fichas` });

    const components = Array.from({ length: 3 }, (_, row) => new ActionRowBuilder().addComponents(
        Array.from({ length: 3 }, (_, col) => {
            const index = row * 3 + col;
            return new ButtonBuilder().setCustomId(`scratch_btn_${index}`).setLabel('▒').setStyle(ButtonStyle.Secondary);
        })
    ));

    const gameReply = await interaction.update({ embeds: [gameEmbed], components, fetchReply: true });
    const gameCollector = gameReply.createMessageComponentCollector({ filter: i => i.user.id === userId, time: 120000 });

    let revealed = {};
    let revealedCount = 0;
    let ended = false;

    gameCollector.on('collect', async btnInteraction => {
        if (ended) return btnInteraction.deferUpdate();

        const index = parseInt(btnInteraction.customId.split('_')[2]);
        const symbol = finalGrid[index];

        revealed[symbol] = (revealed[symbol] || 0) + 1;
        revealedCount++;
        
        components[Math.floor(index / 3)].components[index % 3].setLabel(symbol).setDisabled(true).setStyle(ButtonStyle.Primary);

        await btnInteraction.update({ components });

        const isWinningSymbol = revealed[symbol] === 3 && Object.keys(selectedTicket.payouts).includes(symbol);
        const isBoardFull = revealedCount === selectedTicket.gridSize;

        if (isWinningSymbol || isBoardFull) {
            ended = true;
            gameCollector.stop();

            let finalEmbed;
            if (isWinningSymbol) {
                const winnings = Math.floor(selectedTicket.cost * selectedTicket.payouts[symbol]);
                userProfile = await Profile.findOneAndUpdate({ userId, guildId }, { $inc: { chips: winnings } }, { new: true });
                finalEmbed = new EmbedBuilder().setColor(0x57F287).setTitle(`¡Ganaste ${winnings.toLocaleString()} Fichas!`).setDescription(`¡Felicidades! Combinaste tres **${symbol}** y ganaste un premio increíble.`);
            } else {
                userProfile = await Profile.findOne({ userId, guildId });
                finalEmbed = new EmbedBuilder().setColor(0xED4245).setTitle('¡Mala Suerte!').setDescription('No encontraste ninguna combinación ganadora esta vez.');
            }
            finalEmbed.addFields({ name: 'Saldo de Fichas', value: `${EMOJIS.chips.text} **${userProfile.chips.toLocaleString()}**` });

            for (let i = 0; i < 9; i++) {
                components[Math.floor(i / 3)].components[i % 3].setLabel(finalGrid[i]).setDisabled(true);
            }

            const postGameButtons = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`play_again_${ticketKey}`).setLabel('Volver a Jugar').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('change_ticket').setLabel('Cambiar Boleto').setStyle(ButtonStyle.Secondary)
            );
            
            const finalMessage = await interaction.editReply({ embeds: [finalEmbed], components: [...components, postGameButtons] });
            
            const postGameCollector = finalMessage.createMessageComponentCollector({ filter: i => i.user.id === userId, time: 60000, max: 1 });
            
            postGameCollector.on('collect', async postGameInteraction => {
                if (postGameInteraction.customId.startsWith('play_again_')) {
                    await runGame(postGameInteraction, ticketKey);
                } else if (postGameInteraction.customId === 'change_ticket') {
                    const latestProfile = await Profile.findOne({ userId, guildId });
                    await presentStore(postGameInteraction, latestProfile);
                }
            });

            postGameCollector.on('end', (collected, reason) => {
                if (reason === 'time') {
                    postGameButtons.components.forEach(c => c.setDisabled(true));
                    interaction.editReply({ components: [...components, postGameButtons] }).catch(() => {});
                }
            });
        }
    });

    gameCollector.on('end', (collected, reason) => {
        if (reason === 'time' && !ended) {
            interaction.editReply({ content: 'La sesión de juego ha expirado.', embeds: [], components: [] }).catch(() => {});
        }
    });
}

// --- MAIN COMMAND ---
module.exports = {
    data: new SlashCommandBuilder()
        .setName('scratch')
        .setDescription('Compra y rasca un cartón de lotería interactivo.'),

    async execute(interaction) {
        if (!SCRATCH_TICKETS || Object.keys(SCRATCH_TICKETS).length === 0) {
            console.error("Error Crítico: La configuración SCRATCH_TICKETS no se ha cargado o está vacía en gameConfig.js.");
            return interaction.reply({ content: '❌ **Error de Configuración:** No se pudieron cargar los datos de los cartones de lotería.', ephemeral: true });
        }
        
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;

        await interaction.deferReply();

        let userProfile = await Profile.findOne({ userId, guildId });
        if (!userProfile) {
            return interaction.editReply({ content: 'Primero necesitas crear un perfil. ¡Usa `/profile` para empezar!', ephemeral: true });
        }

        await presentStore(interaction, userProfile);
    },
};

