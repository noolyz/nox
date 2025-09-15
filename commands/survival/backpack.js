// commands/economy/backpack.js

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ComponentType, AttachmentBuilder } = require('discord.js');
const Profile = require('../../models/Profile');
const { BACKPACK_UPGRADES, ITEM_PRICES, EMOJIS, WEAPON_PRICES, WEAPON_STATS, RARITY_EMOJIS, ITEM_RARITY_MAP } = require('../../gameConfig');

const ITEMS_PER_PAGE = 10;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('backpack')
        .setDescription('Shows and manages your equipment.')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user whose equipment you want to see.')
                .setRequired(false)),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const isSelf = targetUser.id === interaction.user.id;
        const fileBackpack = new AttachmentBuilder('./images/backpack.png', { name: 'backpack.png' });

        if (targetUser.bot) {
            const embed = new EmbedBuilder().setColor(0xff0000).setDescription(`${EMOJIS.error.text} Bots don\'t have backpacks.`);
            await interaction.reply({ embeds: [embed], ephemeral: true });
            return;
        }
        await interaction.deferReply();

        let userProfile = await Profile.findOne({ userId: targetUser.id, guildId: interaction.guild.id });
        if (!userProfile) userProfile = await Profile.create({ userId: targetUser.id, guildId: interaction.guild.id });

        let currentPage = 0;
        let currentView = 'main';
        let selectedItem = null;
        let quantityToSell = 1;

        const getBestWeapon = () => {
            const arsenal = Array.from(userProfile.arsenal.keys());
            if (arsenal.length === 0) return { name: 'Fists', power: 5 };
            let bestWeapon = { name: 'Fists', power: 5 };
            for (const weapon of arsenal) {
                const stats = WEAPON_STATS[weapon];
                if (!stats || !stats.damage) continue;
                const power = (stats.damage[0] + stats.damage[1]) / 2;
                if (power > bestWeapon.power) {
                    bestWeapon = { name: weapon, power };
                }
            }
            return bestWeapon;
        };
        
        const calculateInventoryValue = () => {
            let totalValue = 0;
            for (const [itemName, quantity] of userProfile.inventory.entries()) {
                if (quantity > 0) totalValue += (ITEM_PRICES[itemName] || 0) * quantity;
            }
            for (const weaponName of userProfile.arsenal.keys()) {
                totalValue += WEAPON_PRICES[weaponName] || 0;
            }
            return totalValue;
        };

        const generateUI = () => {
            const fullInventoryArray = Array.from(userProfile.inventory.entries()).filter(([, quantity]) => quantity > 0);
            const arsenalArray = Array.from(userProfile.arsenal.keys());

            let embed = new EmbedBuilder();
            let components = [];

            const mainButtons = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('view_items').setLabel('Items').setEmoji(EMOJIS.box.id).setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('view_weapons').setLabel('Arsenal').setEmoji(EMOJIS.sword.id).setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('view_upgrades').setLabel('Backpacks').setEmoji(EMOJIS.backpackdefault.id).setStyle(ButtonStyle.Primary)
            );

            if (currentView === 'main') {
                const backpackInfo = BACKPACK_UPGRADES[userProfile.backpackTier || 0];
                const bestWeapon = getBestWeapon();
                const inventoryValue = calculateInventoryValue();

                embed.setColor(0x7289DA)
                    .setTitle(`${EMOJIS.backpackdefault.text} ${targetUser.username}'s Equipment`)
                    .setThumbnail('attachment://backpack.png')
                    .addFields(
                        { name: 'Equipped Backpack', value: `**${backpackInfo.name}**\n*Capacity: ${fullInventoryArray.length} / ${backpackInfo.capacity}*`, inline: true },
                        { name: 'Primary Weapon', value: `**${bestWeapon.name}**`, inline: true },
                        { name: '‎', value: `Total Inventory Value: ${inventoryValue.toLocaleString()} ${EMOJIS.coin.text}` }
                    )
                    .setFooter({ text: isSelf ? 'Use the buttons below to manage your equipment.' : `Viewing ${targetUser.username}'s equipment.` });
                components.push(mainButtons);
            }
            else if (currentView === 'items_list' || currentView === 'weapons_list') {
                const isWeapons = currentView === 'weapons_list';
                const listArray = isWeapons ? arsenalArray : fullInventoryArray;
                const totalPages = Math.ceil(listArray.length / ITEMS_PER_PAGE);
                
                const start = currentPage * ITEMS_PER_PAGE;
                const end = start + ITEMS_PER_PAGE;
                const pageItems = listArray.slice(start, end);

                const description = pageItems.length > 0 
                    ? pageItems.map(item => {
                        const name = isWeapons ? item : item[0];
                        const qty = isWeapons ? '' : ` - x${item[1]}`;
                        const rarity = ITEM_RARITY_MAP.get(name) || 'common';
                        const rarityEmoji = RARITY_EMOJIS[rarity] || EMOJIS.box.text;
                        return `${rarityEmoji} **${name}**${qty}`;
                      }).join('\n')
                    : (isWeapons ? 'You haven\'t crafted any weapons.' : 'Your backpack is empty.');

                embed.setColor(isWeapons ? 0x99AAB5 : 0x7289DA)
                    .setTitle(isWeapons ? `${EMOJIS.sword.text} ${targetUser.username}'s Arsenal` : `${EMOJIS.box.text} ${targetUser.username}'s Items`)
                    .setDescription(description)
                    .setThumbnail('attachment://backpack.png')
                    .setFooter({ text: `Page ${currentPage + 1} of ${totalPages || 1}` });

                if (pageItems.length > 0) {
                    const menu = new StringSelectMenuBuilder().setCustomId('select_item').setPlaceholder('Select an item to inspect...');
                    pageItems.forEach(item => {
                        const name = isWeapons ? item : item[0];
                        const qty = isWeapons ? '' : ` (x${item[1]})`;
                        menu.addOptions({ label: `${name}${qty}`, value: name });
                    });
                    components.push(new ActionRowBuilder().addComponents(menu));
                }
                
                const navRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('back_to_main').setLabel('Home').setEmoji(EMOJIS.home.id).setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('prev_page').setLabel('Previous').setEmoji(EMOJIS.previous.id).setStyle(ButtonStyle.Secondary).setDisabled(currentPage === 0),
                    new ButtonBuilder().setCustomId('next_page').setLabel('Next').setEmoji(EMOJIS.next.id).setStyle(ButtonStyle.Secondary).setDisabled(currentPage >= (totalPages || 1) - 1)
                );
                components.push(navRow);
            }
            else if (currentView === 'upgrades_list') {
                const currentTier = userProfile.backpackTier || 0;
                const currentBackpack = BACKPACK_UPGRADES[currentTier];
                const nextBackpack = BACKPACK_UPGRADES[currentTier + 1];

                embed.setColor(0x1ABC9C).setTitle(`${EMOJIS.backpackdefault.text} ${targetUser.username}'s Backpack Upgrades`)
                    .addFields({ name: 'Current Backpack', value: `**${currentBackpack.name}**\nCapacity: ${currentBackpack.capacity} items` });

                if (nextBackpack) {
                    embed.addFields({ name: 'Next Upgrade', value: `**${nextBackpack.name}**\nCapacity: ${nextBackpack.capacity} items\n*Go to \`/craft\` to build it.*` }).setThumbnail('attachment://backpack.png');
                } else {
                    embed.addFields({ name: 'Next Upgrade', value: 'You already have the best backpack!' }).setThumbnail('attachment://backpack.png');
                }
                components.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('back_to_main').setLabel('Home').setEmoji(EMOJIS.home.id).setStyle(ButtonStyle.Secondary)));
            }
            else if (currentView === 'item_detail' || currentView === 'weapon_detail') {
                const isWeapon = selectedItem.type === 'weapon';
                const price = isWeapon ? WEAPON_PRICES[selectedItem.name] : ITEM_PRICES[selectedItem.name];
                const quantity = isWeapon ? 1 : userProfile.inventory.get(selectedItem.name);
                const rarity = ITEM_RARITY_MAP.get(selectedItem.name) || 'common';
                const rarityEmoji = RARITY_EMOJIS[rarity] || EMOJIS.box.text;

                embed.setColor(0xFEE75C).setTitle(`${rarityEmoji} Inspecting: ${selectedItem.name}`)
                    .addFields(
                        { name: 'Quantity', value: `${quantity}`, inline: true },
                        { name: 'Sell Value', value: `${price?.toLocaleString() || 'Not Sellable'}`, inline: true },
                        { name: 'Rarity', value: rarity.charAt(0).toUpperCase() + rarity.slice(1), inline: true }
                    )
                    .setThumbnail('attachment://backpack.png');
                
                const actionRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('back_to_list').setLabel('Back to List').setEmoji(EMOJIS.back.id).setStyle(ButtonStyle.Secondary)
                );
                if (isSelf && price) {
                    actionRow.addComponents(new ButtonBuilder().setCustomId('sell_item').setLabel('Sell').setEmoji(EMOJIS.money.id).setStyle(ButtonStyle.Success));
                }
                components.push(actionRow);
            }
            else if (currentView === 'sell_quantity') {
                const maxQty = userProfile.inventory.get(selectedItem.name);
                const totalValue = (ITEM_PRICES[selectedItem.name] || 0) * quantityToSell;

                embed.setColor(0x57F287).setTitle(`Sell ${selectedItem.name}`).setDescription(`Select how many you want to sell. You have **${maxQty}**.\n\nSell Value: **${totalValue.toLocaleString()}** ${EMOJIS.coin.text}.`).setThumbnail('attachment://backpack.png');
                
                const row1 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('decrease_qty').setEmoji(EMOJIS.minus.id).setStyle(ButtonStyle.Danger).setDisabled(quantityToSell <= 1),
                    new ButtonBuilder().setCustomId('quantity_info').setLabel(`${quantityToSell} / ${maxQty}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
                    new ButtonBuilder().setCustomId('increase_qty').setEmoji(EMOJIS.plus.id).setStyle(ButtonStyle.Success).setDisabled(quantityToSell >= maxQty),
                    new ButtonBuilder().setCustomId('max_qty').setLabel('Max').setStyle(ButtonStyle.Primary).setDisabled(quantityToSell === maxQty)
                );
                const row2 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('custom_qty').setLabel('Custom Amount').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('confirm_quantity').setLabel('Confirm Sale').setEmoji(EMOJIS.check.id).setStyle(ButtonStyle.Success)
                );
                const row3 = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('back_to_detail').setLabel('Back to Item').setEmoji(EMOJIS.back.id).setStyle(ButtonStyle.Danger));
                components = [row1, row2, row3];
            }
            else if (currentView === 'sell_confirm') {
                const isWeapon = selectedItem.type === 'weapon';
                const price = isWeapon ? WEAPON_PRICES[selectedItem.name] : ITEM_PRICES[selectedItem.name];
                const totalValue = (price || 0) * quantityToSell;
                embed.setColor(0xED4245).setTitle('Are you sure?').setDescription(`You are about to sell **${quantityToSell}x ${selectedItem.name}** for a total of **${totalValue.toLocaleString()}** ${EMOJIS.coinstack.text}. This action cannot be undone.`).setThumbnail('attachment://backpack.png');
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('final_confirm_sell').setLabel('Yes, sell').setEmoji(EMOJIS.check.id).setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('cancel_final').setLabel('No, go back').setEmoji(EMOJIS.close.id).setStyle(ButtonStyle.Danger)
                );
                components = [row];
            }

            return { embeds: [embed], components, files: [fileBackpack] };
        };

        const reply = await interaction.editReply(generateUI());
        const collector = reply.createMessageComponentCollector({ filter: i => i.user.id === interaction.user.id, time: 30000 });

        collector.on('collect', async i => {
            if (i.customId === 'custom_qty') {
                const modal = new ModalBuilder().setCustomId(`qty_modal_${i.id}`).setTitle('Custom Sell Amount');
                const qtyInput = new TextInputBuilder().setCustomId('qty_input').setLabel(`How many ${selectedItem.name} to sell?`).setStyle(TextInputStyle.Short).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(qtyInput));
                await i.showModal(modal);
                try {
                    const modalSubmit = await i.awaitModalSubmit({ filter: mi => mi.customId === `qty_modal_${i.id}`, time: 30000 });
                    const num = parseInt(modalSubmit.fields.getTextInputValue('qty_input'));
                    const maxQty = userProfile.inventory.get(selectedItem.name);
                    if (!isNaN(num) && num > 0 && num <= maxQty) {
                        quantityToSell = num;
                    }
                    await modalSubmit.deferUpdate();
                } catch (err) { /* Timeout */ }
            } else {
                await i.deferUpdate();
            }
            
            userProfile = await Profile.findOne({ userId: targetUser.id, guildId: interaction.guild.id });

            if (i.customId.startsWith('view_')) { currentView = i.customId.replace('view_', '') + '_list'; currentPage = 0; }
            if (i.customId === 'back_to_main') { currentView = 'main'; }
            if (i.customId === 'back_to_list') { currentView = selectedItem.type === 'weapon' ? 'weapons_list' : 'items_list'; }
            if (i.customId === 'back_to_detail') { currentView = 'item_detail'; }
            if (i.customId === 'prev_page') currentPage--;
            if (i.customId === 'next_page') currentPage++;
            if (i.customId === 'sell_item') { currentView = selectedItem.type === 'weapon' ? 'sell_confirm' : 'sell_quantity'; quantityToSell = 1; }
            if (i.customId === 'increase_qty') quantityToSell++;
            if (i.customId === 'decrease_qty') quantityToSell--;
            if (i.customId === 'max_qty') quantityToSell = userProfile.inventory.get(selectedItem.name);
            if (i.customId === 'confirm_quantity') { currentView = 'sell_confirm'; }
            if (i.customId === 'cancel_final') { currentView = selectedItem.type === 'weapon' ? 'weapon_detail' : 'sell_quantity'; }

            if (i.isStringSelectMenu() && i.customId === 'select_item') {
                const itemName = i.values[0];
                const isWeapon = WEAPON_PRICES[itemName] !== undefined;
                selectedItem = { name: itemName, type: isWeapon ? 'weapon' : 'item' };
                currentView = isWeapon ? 'weapon_detail' : 'item_detail';
            }

            if (i.customId === 'final_confirm_sell') {
                const isWeapon = selectedItem.type === 'weapon';
                const price = isWeapon ? WEAPON_PRICES[selectedItem.name] : ITEM_PRICES[selectedItem.name];
                const totalValue = (price || 0) * quantityToSell;
                
                if (isWeapon) {
                    userProfile.arsenal.delete(selectedItem.name);
                } else {
                    const currentQty = userProfile.inventory.get(selectedItem.name);
                    if (currentQty - quantityToSell > 0) {
                        userProfile.inventory.set(selectedItem.name, currentQty - quantityToSell);
                    } else {
                        userProfile.inventory.delete(selectedItem.name);
                    }
                }
                userProfile.bank += totalValue;
                
                userProfile.markModified('inventory');
                userProfile.markModified('arsenal');
                await userProfile.save();

                const successEmbed = new EmbedBuilder().setColor(0x2ECC71).setTitle(`${EMOJIS.done.text} Successful Sale`).setDescription(`You sold **${quantityToSell}x ${selectedItem.name}** for **${totalValue.toLocaleString()}** ${EMOJIS.coin.text}.`).setThumbnail('attachment://backpack.png');
                
                const finalRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('back_to_main').setLabel('Home').setEmoji(EMOJIS.home.id).setStyle(ButtonStyle.Primary));
                await interaction.editReply({ embeds: [successEmbed], components: [finalRow] });
                return;
            }

            await interaction.editReply(generateUI());
            collector.resetTimer();
        });
 
        const fileCloseBackpack = new AttachmentBuilder('./images/caution_img.png', { name: 'caution_img.png' });

        collector.on('end', () => {
            const closeEmbed = new EmbedBuilder().setColor(0xED4245).setTitle('Session Expired').setDescription('The backpack session has expired and is no longer active because of inactivity\n\nTry opening the backpack again using `/backpack`.').setThumbnail('attachment://caution_img.png').setFooter({ text: 'Use your time wisely' });
            interaction.editReply({ embeds: [closeEmbed], components: [], files: [fileCloseBackpack] }).catch(() => {});
        });
    },
};
