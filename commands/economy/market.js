const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, StringSelectMenuBuilder } = require('discord.js');
const MarketItem = require('../../models/MarketItem');
const Profile = require('../../models/Profile');
const { EMOJIS } = require('../../gameConfig');

const ITEMS_PER_PAGE = 6;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('market')
        .setDescription('Compra roles exclusivos del servidor con tus monedas.'),

    async execute(interaction) {
        await interaction.deferReply();

        const guildId = interaction.guild.id;
        const items = await MarketItem.find({ guildId });

        if (items.length === 0) {
            const emptyEmbed = new EmbedBuilder()
                .setColor(0xF4B32B)
                .setTitle(`🏪 Mercado de ${interaction.guild.name}`)
                .setDescription('Actualmente no hay artículos a la venta.\n¡Pídele a un administrador que añada algunos usando `/market-admin add`!');
            return interaction.editReply({ embeds: [emptyEmbed] });
        }

        let page = 0;
        const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);

        const generateEmbed = async (currentPage) => {
            const start = currentPage * ITEMS_PER_PAGE;
            const end = start + ITEMS_PER_PAGE;
            const currentItems = items.slice(start, end);

            const marketEmbed = new EmbedBuilder()
                .setColor(0x3498DB)
                .setTitle(`🏪 Mercado de ${interaction.guild.name}`)
                .setDescription('¡Adquiere roles exclusivos y demuestra tu estatus!')
                .setFooter({ text: `Página ${currentPage + 1} de ${totalPages}` });

            if (currentItems.length === 0) {
                 marketEmbed.setDescription('No hay más artículos disponibles.');
            } else {
                for (const item of currentItems) {
                    const role = await interaction.guild.roles.fetch(item.roleId).catch(() => null);
                    if (role) {
                        marketEmbed.addFields({
                            name: `${EMOJIS.pricetag.text} ${item.name}`,
                            value: `*${item.description}*\n**Precio:** ${item.price.toLocaleString()} ${EMOJIS.coin.text}\n`,
                            inline: true,
                        });
                    }
                }
            }

            return marketEmbed;
        };

        const generateButtons = (currentPage) => {
            const buttons = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('market_prev')
                    .setLabel('Anterior')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentPage === 0),
                new ButtonBuilder()
                    .setCustomId('market_next')
                    .setLabel('Siguiente')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentPage >= totalPages - 1),
                new ButtonBuilder()
                    .setCustomId('market_buy')
                    .setLabel('Comprar')
                    .setStyle(ButtonStyle.Success)
            );
            return buttons;
        };

        const initialEmbed = await generateEmbed(page);
        const initialButtons = generateButtons(page);
        
        const reply = await interaction.editReply({ embeds: [initialEmbed], components: [initialButtons] });
        
        const collector = reply.createMessageComponentCollector({
            componentType: ComponentType.Button,
            filter: i => i.user.id === interaction.user.id,
            time: 300000 // 5 minutos
        });

        collector.on('collect', async i => {
            try {
                // --- SOLUCIÓN AL ERROR: Acusar recibo inmediatamente ---
                await i.deferUpdate();

                if (i.customId === 'market_next') {
                    page++;
                } else if (i.customId === 'market_prev') {
                    page--;
                } else if (i.customId === 'market_buy') {
                    collector.stop();
                    await handlePurchase(interaction, i);
                    return;
                }

                const newEmbed = await generateEmbed(page);
                const newButtons = generateButtons(page);
                await interaction.editReply({ embeds: [newEmbed], components: [newButtons] });

            } catch (error) {
                // Failsafe para interacciones desconocidas
                if (error.code === 10062) {
                    console.log('Intento de usar una interacción de mercado expirada. Ignorando.');
                } else {
                    console.error('Error en el colector del mercado:', error);
                }
            }
        });

        collector.on('end', (collected, reason) => {
            if (reason === 'time') {
                const disabledButtons = generateButtons(page);
                disabledButtons.components.forEach(button => button.setDisabled(true));
                interaction.editReply({ components: [disabledButtons] }).catch(() => {});
            }
        });
    },
};


async function handlePurchase(originalInteraction, buttonInteraction) {
    const guildId = originalInteraction.guild.id;
    const userId = originalInteraction.user.id;
    const items = await MarketItem.find({ guildId });

    const options = await Promise.all(items.map(async item => {
        const role = await originalInteraction.guild.roles.fetch(item.roleId).catch(() => null);
        return {
            label: item.name,
            description: `Precio: ${item.price.toLocaleString()} monedas`,
            value: item.roleId,
            emoji: role ? (role.iconURL() ? { id: role.icon } : EMOJIS.pricetag.text) : '❌'
        };
    }));
    
    const selectMenu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('market_buy_select')
            .setPlaceholder('Selecciona el rol que deseas comprar...')
            .addOptions(options)
    );

    const purchaseMessage = await originalInteraction.editReply({ content: '¿Qué artículo deseas adquirir?', components: [selectMenu], embeds: [] });

    const selectCollector = purchaseMessage.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        filter: i => i.user.id === userId,
        time: 60000,
        max: 1
    });

    selectCollector.on('collect', async selectInteraction => {
        try {
            await selectInteraction.deferUpdate();

            const roleId = selectInteraction.values[0];
            const item = items.find(it => it.roleId === roleId);
            const userProfile = await Profile.findOne({ userId, guildId });

            if (userProfile.wallet < item.price) {
                return await originalInteraction.editReply({ content: `No tienes suficientes monedas para comprar **${item.name}**.`, components: [], embeds: [] });
            }

            const member = await originalInteraction.guild.members.fetch(userId);
            if (member.roles.cache.has(roleId)) {
                return await originalInteraction.editReply({ content: `Ya posees el rol **${item.name}**.`, components: [], embeds: [] });
            }
            
            const confirmButton = new ButtonBuilder().setCustomId('confirm_purchase').setLabel('Confirmar').setStyle(ButtonStyle.Success);
            const cancelButton = new ButtonBuilder().setCustomId('cancel_purchase').setLabel('Cancelar').setStyle(ButtonStyle.Danger);
            const confirmRow = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

            const confirmEmbed = new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle('Confirmar Compra')
                .setDescription(`¿Estás seguro de que quieres comprar el rol **${item.name}** por **${item.price.toLocaleString()}** ${EMOJIS.coin.text}?`)
                .addFields({ name: 'Tu Saldo Actual', value: `${userProfile.wallet.toLocaleString()} ${EMOJIS.coin.text}`});

            await originalInteraction.editReply({ embeds: [confirmEmbed], components: [confirmRow], content: '' });

            const buttonCollector = purchaseMessage.createMessageComponentCollector({ componentType: ComponentType.Button, filter: i => i.user.id === userId, time: 60000, max: 1 });
            
            buttonCollector.on('collect', async finalInteraction => {
                try {
                    await finalInteraction.deferUpdate();

                    if (finalInteraction.customId === 'confirm_purchase') {
                        const currentProfile = await Profile.findOne({ userId, guildId });
                        if (currentProfile.wallet < item.price) {
                             return await originalInteraction.editReply({ content: `Ya no tienes suficientes monedas.`, components: [], embeds: [] });
                        }

                        await member.roles.add(roleId);
                        const updatedProfile = await Profile.findOneAndUpdate({ userId, guildId }, { $inc: { wallet: -item.price } }, { new: true });
                        
                        const successEmbed = new EmbedBuilder()
                            .setColor(0x57F287)
                            .setTitle('✅ ¡Compra Exitosa!')
                            .setDescription(`Has adquirido el rol **${item.name}**.`)
                            .addFields({ name: 'Nuevo Saldo', value: `${updatedProfile.wallet.toLocaleString()} ${EMOJIS.coin.text}`});
                        
                        await originalInteraction.editReply({ embeds: [successEmbed], components: [] });

                    } else { // Cancel
                        await originalInteraction.editReply({ content: 'Compra cancelada.', components: [], embeds: [] });
                    }
                } catch (err) { console.error('Error en la confirmación de compra:', err); }
            });

        } catch (err) { console.error('Error en la selección de compra:', err); }
    });
}

