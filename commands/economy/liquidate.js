// commands/economy/liquidate.js

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const Profile = require('../../models/Profile');
const { ITEM_PRICES, EMOJIS, RARITY_EMOJIS, ITEM_RARITY_MAP } = require('../../gameConfig');

const ITEMS_PER_PAGE = 15;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('liquidate')
        .setDescription('Sell multiple items from your inventory at once.'),

    async execute(interaction) {
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;

        await interaction.deferReply({ ephemeral: true });

        let userProfile = await Profile.findOne({ userId, guildId });
        if (!userProfile) {
            return interaction.editReply('You need a profile to sell items.');
        }

        let currentPage = 0;
        let currentView = 'selection'; // selection, confirmation, success
        let selectedItems = [];
        let lastSaleTotal = 0;

        const generateUI = () => {
            const sellableInventoryArray = Array.from(userProfile.inventory.entries())
                .filter(([itemName, quantity]) => ITEM_PRICES[itemName] !== undefined && quantity > 0);

            if (sellableInventoryArray.length === 0 && currentView !== 'success') {
                return { 
                    embeds: [new EmbedBuilder().setColor(0xED4245).setTitle('No Items to Sell').setDescription('You don\'t have any items that can be sold.')],
                    components: [] 
                };
            }

            let embed = new EmbedBuilder();
            let components = [];

            if (currentView === 'selection') {
                const totalPages = Math.ceil(sellableInventoryArray.length / ITEMS_PER_PAGE);
                const start = currentPage * ITEMS_PER_PAGE;
                const end = start + ITEMS_PER_PAGE;
                const pageItems = sellableInventoryArray.slice(start, end);

                const description = pageItems.map(([name, qty]) => {
                    const rarity = ITEM_RARITY_MAP.get(name) || 'common';
                    const rarityEmoji = RARITY_EMOJIS[rarity] || '📦';
                    const price = ITEM_PRICES[name] || 0;
                    return `${rarityEmoji} **${name}** (x${qty}) - *Value: ${price.toLocaleString()} each*`;
                }).join('\n');

                embed.setColor(0x57F287)
                    .setTitle('📦 Black Market - Liquidation Terminal')
                    .setDescription(`Select up to 3 different items you wish to sell. This will sell **all** units of the selected items.\n\n${description}`)
                    .setFooter({ text: `Page ${currentPage + 1} of ${totalPages || 1}` });

                if (pageItems.length > 0) {
                    const selectMenu = new StringSelectMenuBuilder()
                        .setCustomId('select_items_to_sell')
                        .setPlaceholder('Select up to 3 item types to liquidate...')
                        .setMinValues(1)
                        .setMaxValues(Math.min(pageItems.length, 3))
                        .addOptions(pageItems.map(([name, qty]) => ({
                            label: `${name} (x${qty})`,
                            value: name,
                        })));
                    components.push(new ActionRowBuilder().addComponents(selectMenu));
                }
                
                const navRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('prev_page').setLabel('Previous').setStyle(ButtonStyle.Secondary).setDisabled(currentPage === 0),
                    new ButtonBuilder().setCustomId('next_page').setLabel('Next').setStyle(ButtonStyle.Secondary).setDisabled(currentPage >= (totalPages || 1) - 1)
                );
                components.push(navRow);
            } 
            else if (currentView === 'confirmation') {
                let totalValue = 0;
                const itemsBreakdown = selectedItems.map(itemName => {
                    const quantity = userProfile.inventory.get(itemName);
                    const price = ITEM_PRICES[itemName] || 0;
                    const subtotal = quantity * price;
                    totalValue += subtotal;
                    const rarity = ITEM_RARITY_MAP.get(itemName) || 'common';
                    const rarityEmoji = RARITY_EMOJIS[rarity] || '📦';
                    return `${rarityEmoji} **${itemName}** (x${quantity}) for **${subtotal.toLocaleString()}** ${EMOJIS.coin.text}`;
                }).join('\n');

                embed.setColor(0xFEE75C)
                    .setTitle('🧾 Sales Invoice')
                    .setDescription(`You are about to sell the following items. This action is irreversible.\n\n${itemsBreakdown}`)
                    .addFields({ name: 'Grand Total', value: `**${totalValue.toLocaleString()}** ${EMOJIS.coinstack.text}` });

                const confirmRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('confirm_final_sell').setLabel('Confirm Liquidation').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('cancel_sell').setLabel('Cancel').setStyle(ButtonStyle.Danger)
                );
                components.push(confirmRow);
            }
            else if (currentView === 'success') {
                embed.setColor(0x2ECC71)
                    .setTitle('✅ Transaction Complete')
                    .setDescription(`You have successfully sold your items for a total of **${lastSaleTotal.toLocaleString()}** ${EMOJIS.coin.text}. The funds have been deposited into your bank account.`);
                
                const successRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('sell_more').setLabel('Liquidate More Items').setStyle(ButtonStyle.Primary)
                );
                components.push(successRow);
            }

            return { embeds: [embed], components };
        };

        const reply = await interaction.editReply(generateUI());
        const collector = reply.createMessageComponentCollector({ filter: i => i.user.id === userId, time: 180000 });

        collector.on('collect', async i => {
            await i.deferUpdate();
            userProfile = await Profile.findOne({ userId, guildId });

            if (i.customId === 'prev_page') currentPage--;
            if (i.customId === 'next_page') currentPage++;
            if (i.customId === 'cancel_sell' || i.customId === 'sell_more') { 
                currentView = 'selection'; 
                currentPage = 0; 
            }

            if (i.isStringSelectMenu() && i.customId === 'select_items_to_sell') {
                selectedItems = i.values;
                currentView = 'confirmation';
            }

            if (i.customId === 'confirm_final_sell') {
                let totalValue = 0;
                for (const itemName of selectedItems) {
                    const quantity = userProfile.inventory.get(itemName);
                    const price = ITEM_PRICES[itemName] || 0;
                    totalValue += quantity * price;
                    userProfile.inventory.delete(itemName);
                }
                
                userProfile.bank += totalValue;
                userProfile.markModified('inventory');
                await userProfile.save();
                
                lastSaleTotal = totalValue;
                currentView = 'success';
            }

            await interaction.editReply(generateUI());
        });

        collector.on('end', (collected, reason) => {
            if (reason === 'time') {
                interaction.editReply({ content: 'The sell session has expired.', components: [] }).catch(() => {});
            }
        });
    },
};
