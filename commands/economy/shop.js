const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, ModalBuilder, TextInputBuilder, TextInputStyle, AttachmentBuilder, StringSelectMenuBuilder } = require('discord.js');
const Profile = require('../../models/Profile');
const Shop = require('../../models/Shop');
const { generateShopImage } = require('../../utils/shopRenderer');
const { ITEM_PRICES, ITEM_RARITY_MAP, RARITY_EMOJIS, BACKPACK_UPGRADES, EMOJIS, STOCK_RANGES, SHOP_RARITY_WEIGHTS, SHOP_DEAL_OF_THE_DAY_DISCOUNT } = require('../../gameConfig');

const activeShopSessions = new Set();
const toSafeId = (name) => name.replace(/\s+/g, '-').toLowerCase();

// --- Lógica de la Tienda (Sin cambios) ---
const allowedItemNames = Object.keys(ITEM_PRICES).filter(name => !name.includes('.') && ITEM_RARITY_MAP.get(name) !== 'secret');
const itemsByRarity = { common: [], rare: [], epic: [], mythical: [], legendary: [] };
allowedItemNames.forEach(name => {
    const rarity = ITEM_RARITY_MAP.get(name);
    if (rarity && itemsByRarity[rarity]) itemsByRarity[rarity].push({ name, basePrice: ITEM_PRICES[name], type: 'item' });
});
function getRandomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function generateDailyShopItems() {
    const weightedRarityPool = [];
    for (const [rarity, weight] of Object.entries(SHOP_RARITY_WEIGHTS)) { for (let i = 0; i < weight; i++) weightedRarityPool.push(rarity); }
    const selectedItems = new Set();
    const finalShopItems = [];
    while (finalShopItems.length < 6 && selectedItems.size < allowedItemNames.length) {
        const randomRarity = weightedRarityPool[Math.floor(Math.random() * weightedRarityPool.length)];
        const itemsOfRarity = itemsByRarity[randomRarity];
        if (!itemsOfRarity || itemsOfRarity.length === 0) continue;
        const randomItem = itemsOfRarity[Math.floor(Math.random() * itemsOfRarity.length)];
        if (!selectedItems.has(randomItem.name)) {
            selectedItems.add(randomItem.name);
            const stockRange = STOCK_RANGES[randomRarity] || { min: 1, max: 1 };
            finalShopItems.push({ name: randomItem.name, basePrice: randomItem.basePrice, rarity: randomRarity, type: 'item', stock: getRandomInt(stockRange.min, stockRange.max) });
        }
    }
    const dealIndex = Math.floor(Math.random() * finalShopItems.length);
    return finalShopItems.map((item, index) => {
        const baseDiscountPrice = Math.ceil(item.basePrice * 0.4);
        const finalPrice = index === dealIndex ? Math.ceil(baseDiscountPrice * SHOP_DEAL_OF_THE_DAY_DISCOUNT) : baseDiscountPrice;
        return { ...item, price: finalPrice, isDealOfTheDay: index === dealIndex };
    });
}
function getBackpackCapacity(tier) { return (BACKPACK_UPGRADES.find(u => u.tier === tier) || { capacity: 12 }).capacity; }

async function getOrCreateShop() {
    const shopId = new Date().toISOString().slice(0, 10);
    return await Shop.findOneAndUpdate(
        { date: shopId }, { $setOnInsert: { items: generateDailyShopItems(), date: shopId } }, { upsert: true, new: true, lean: true }
    );
}

// --- Comando Principal ---
module.exports = {
    data: new SlashCommandBuilder().setName('shop').setDescription('Visita el Mercado Negro para encontrar ofertas únicas que rotan diariamente.'),
    async execute(interaction) {
        if (activeShopSessions.has(interaction.channelId)) {
            return interaction.reply({ content: 'Ya hay una sesión del Mercado Negro activa en este canal.', ephemeral: true });
        }
        await interaction.deferReply();
        activeShopSessions.add(interaction.channelId);

        try {
            const shopMessage = await interaction.fetchReply();
            const renderShop = async () => {
                const shop = await Shop.findOne({ date: new Date().toISOString().slice(0, 10) }).lean();
                if (!shop) { return await shopMessage.edit({ content: 'La tienda no está disponible.', embeds: [], files: [], components: [] }).catch(() => { }); }

                const shopImageBuffer = await generateShopImage(shop.items);
                const attachment = new AttachmentBuilder(shopImageBuffer, { name: 'shop-catalog.png' });
                const tomorrow = new Date(); tomorrow.setUTCHours(24, 0, 0, 0);
                const { default: prettyMilliseconds } = await import('pretty-ms');

                const embed = new EmbedBuilder()
                    .setColor(0x2C2F33).setTitle('Catálogo del Mercado Negro')
                    .setImage('attachment://shop-catalog.png')
                    .setFooter({ text: `El inventario se reabastece en ${prettyMilliseconds(tomorrow.getTime() - Date.now(), { verbose: true, secondsDecimalDigits: 0 })}.` });
                
                const purchaseButton = new ButtonBuilder()
                    .setCustomId('shop_open_purchase_menu')
                    .setLabel('Comprar un Artículo')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('🛒');
                
                const row = new ActionRowBuilder().addComponents(purchaseButton);

                await shopMessage.edit({ embeds: [embed], files: [attachment], components: [row] });
            };

            await getOrCreateShop();
            await renderShop();

            const collector = shopMessage.createMessageComponentCollector({ componentType: ComponentType.Button, idle: 30000 });

            collector.on('collect', async (buttonInteraction) => {
                try {
                    if (buttonInteraction.user.id !== interaction.user.id) { return buttonInteraction.reply({ content: 'Esta no es tu sesión de compra.', ephemeral: true }); }

                    const shopState = await Shop.findOne({ date: new Date().toISOString().slice(0, 10) }).lean();
                    const availableItems = shopState.items.filter(item => item.stock > 0);
                    if (availableItems.length === 0) { return await buttonInteraction.reply({ content: 'Todos los artículos de la tienda están agotados.', ephemeral: true }); }

                    const selectMenu = new StringSelectMenuBuilder()
                        .setCustomId('shop_select_item_to_buy')
                        .setPlaceholder('Selecciona el artículo que te interesa...')
                        .addOptions(availableItems.map(item => ({
                            label: item.name,
                            description: `Precio: ${item.price.toLocaleString()} | Stock: ${item.stock}`,
                            value: toSafeId(item.name),
                            emoji: RARITY_EMOJIS[item.rarity]?.text || '📦',
                        })));
                    
                    const menuRow = new ActionRowBuilder().addComponents(selectMenu);
                    await buttonInteraction.reply({ content: 'Elige qué artículo quieres comprar.', components: [menuRow], ephemeral: true, fetchReply: true });

                    const selectInteraction = await buttonInteraction.channel.awaitMessageComponent({
                        filter: i => i.customId === 'shop_select_item_to_buy' && i.user.id === interaction.user.id, componentType: ComponentType.StringSelect, time: 60000
                    }).catch(() => null);

                    if (!selectInteraction) { return await buttonInteraction.editReply({ content: 'La selección ha expirado.', components: [] }); }

                    const safeId = selectInteraction.values[0];
                    const itemToBuy = availableItems.find(item => toSafeId(item.name) === safeId);

                    const modal = new ModalBuilder().setCustomId(`shop_quantity_modal_${safeId}`).setTitle(`Comprar ${itemToBuy.name}`);
                    const quantityInput = new TextInputBuilder().setCustomId('quantity').setLabel(`Cantidad (Stock: ${itemToBuy.stock})`).setStyle(TextInputStyle.Short).setPlaceholder('1').setRequired(true);
                    modal.addComponents(new ActionRowBuilder().addComponents(quantityInput));
                    await selectInteraction.showModal(modal);

                    const modalSubmit = await selectInteraction.awaitModalSubmit({ filter: i => i.user.id === interaction.user.id, time: 60000 }).catch(() => null);
                    if (!modalSubmit) { return await buttonInteraction.editReply({ content: 'La compra ha expirado.', components: [] }); }
                    
                    await modalSubmit.deferUpdate();

                    const quantity = parseInt(modalSubmit.fields.getTextInputValue('quantity'), 10);
                    if (isNaN(quantity) || quantity <= 0) { return await buttonInteraction.editReply({ content: 'Por favor, introduce un número válido.', components: [] }); }

                    const shopId = new Date().toISOString().slice(0, 10);
                    const userProfile = await Profile.findOne({ userId: modalSubmit.user.id, guildId: modalSubmit.guild.id });
                    
                    const currentShopState = await Shop.findOne({ date: shopId }).lean();
                    const itemState = currentShopState.items.find(item => item.name === itemToBuy.name);

                    if (!itemState || itemState.stock < quantity) {
                        await buttonInteraction.editReply({ content: `No hay suficiente stock para comprar ${quantity}x "${itemToBuy.name}".`, components:[] });
                        return await renderShop();
                    }
                    const totalPrice = itemState.price * quantity;
                    if (userProfile.wallet < totalPrice) { return await buttonInteraction.editReply({ content: `No tienes suficientes monedas. Necesitas **${totalPrice.toLocaleString()}** ${EMOJIS.coin.text}.`, components:[] }); }

                    // --- LÓGICA DE MOCHILA CORREGIDA ---
                    const capacity = getBackpackCapacity(userProfile.backpackTier);
                    const currentItemCount = userProfile.inventory.size;
                    const isNewItem = !userProfile.inventory.has(itemToBuy.name);

                    // La comprobación: si es un item nuevo Y ya no hay espacio, se bloquea.
                    if (isNewItem && currentItemCount >= capacity) {
                        return await buttonInteraction.editReply({ 
                            content: `Tu mochila está llena. No puedes añadir más tipos de objetos.`, 
                            components:[] 
                        });
                    }
                    // --- FIN DE LA LÓGICA CORREGIDA ---


                    const updateResult = await Shop.updateOne(
                        { date: shopId, items: { $elemMatch: { name: itemToBuy.name, stock: { $gte: quantity } } } },
                        { $inc: { "items.$[item].stock": -quantity } },
                        { arrayFilters: [ { "item.name": itemToBuy.name } ] }
                    );

                    if (updateResult.modifiedCount === 0) {
                        await buttonInteraction.editReply({ content: '¡Fallo de concurrencia! Alguien compró el stock justo antes que tú.', components:[] });
                        return await renderShop();
                    }

                    userProfile.wallet -= totalPrice;
                    userProfile.inventory.set(itemToBuy.name, (userProfile.inventory.get(itemToBuy.name) || 0) + quantity);
                    userProfile.markModified('inventory');
                    await userProfile.save();
                    
                    await buttonInteraction.editReply({ content: `✅ ¡Compra exitosa! Has adquirido **${quantity}x ${itemToBuy.name}** por **${totalPrice.toLocaleString()}** ${EMOJIS.coin.text}.`, components: [] });

                    setTimeout(() => {
                        buttonInteraction.deleteReply().catch(() => {});
                    }, 5000);

                    await renderShop();
                } catch (error) { if (error.code !== 10062 && error.code !== 10008) { console.error("Error en el colector de la tienda:", error); } }
            });

            collector.on('end', async (collected, reason) => {
                activeShopSessions.delete(interaction.channelId);
                try {
                    if (reason === 'idle') {
                        const timeoutEmbed = new EmbedBuilder().setColor(0xED4245).setTitle('Sesión del Mercado Negro Cerrada').setDescription('La sesión ha finalizado por inactividad.');
                        await shopMessage.edit({ embeds: [timeoutEmbed], files: [], components: [] }).catch(() => { });
                    } else {
                        const finalRow = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('shop_closed').setLabel('La sesión ha finalizado').setStyle(ButtonStyle.Secondary).setDisabled(true)
                        );
                        await shopMessage.edit({ components: [finalRow] }).catch(() => {});
                    }
                } catch (error) { /* Ignorar errores */ }
            });
        } catch (error) {
            console.error("Error al iniciar el comando de tienda:", error);
            activeShopSessions.delete(interaction.channelId);
            await interaction.editReply({ content: "Ocurrió un error al iniciar la tienda." }).catch(() => { });
        }
    },
};

