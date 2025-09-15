const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, AttachmentBuilder } = require('discord.js');
const Profile = require('../../models/Profile');
const { BACKPACK_UPGRADES, EMOJIS, CRAFTING_RECIPES } = require('../../gameConfig');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('craft')
        .setDescription('Craft weapons, backpacks, and gear.'),

    async execute(interaction) {
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;
        const craftFile = new AttachmentBuilder('./images/craft.png', { name: 'craft.png' });

        await interaction.deferReply();

        let userProfile = await Profile.findOne({ userId, guildId });
        if (!userProfile) {
            userProfile = await Profile.create({ userId, guildId });
        }

        let currentCategory = null;
        let selectedRecipe = null;

        const generateMainEmbed = () => new EmbedBuilder().setColor(0xC27C0E).setTitle('Crafting table').setDescription('Select a category to show the recipes').setThumbnail('attachment://craft.png').setFooter({ text: 'You can craft melee weapons, guns, and backpacks' });
        const generateMainComponents = () => new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('craft_category_select').setPlaceholder('Select category...').addOptions({ label: 'melee weapons', value: 'melee_weapons', emoji: EMOJIS.sword.id }, { label: 'Guns', value: 'guns', emoji: EMOJIS.ak47.id }, { label: 'Backpacks', value: 'backpacks', emoji: EMOJIS.backpack4.id }));

        const generateRecipeListEmbed = (category) => {
            const embed = new EmbedBuilder().setColor(0x3498DB).setTitle(`Recipes ${category}`).setDescription('Select an object of the menu to see details.').setThumbnail('attachment://craft.png');
            CRAFTING_RECIPES[category].forEach(recipe => {
                embed.addFields({ name: `${recipe.name} [${recipe.rarity}]`, value: `*${recipe.description}*\n**Status:** ${userProfile.arsenal.get(recipe.name) ? `${EMOJIS.done.text} Already crafted` : `${EMOJIS.close.text} Not crafted yet`}`, inline: false });
            });
            return embed;
        };

        const generateRecipeComponents = (category) => {
            const menu = new StringSelectMenuBuilder().setCustomId('craft_recipe_select').setPlaceholder('Select objet to craft...').addOptions(CRAFTING_RECIPES[category].map(recipe => ({ label: `${recipe.name} [${recipe.rarity}]`, value: recipe.name })));
            const backButton = new ButtonBuilder().setCustomId('back_to_main').setEmoji(EMOJIS.back.id).setLabel('Back').setStyle(ButtonStyle.Secondary);
            return [new ActionRowBuilder().addComponents(menu), new ActionRowBuilder().addComponents(backButton)];
        };
        
        const generateBackpackListEmbed = () => {
            const currentTier = userProfile.backpackTier || 0;
            const embed = new EmbedBuilder().setColor(0x1ABC9C).setTitle('Backpack upgrades').setDescription('Select an upgrade from the menu to see the requirements.').setThumbnail('attachment://craft.png');
            BACKPACK_UPGRADES.forEach(upgrade => {
                if (upgrade.tier === 0) return;
                let status = upgrade.tier <= currentTier ? `${EMOJIS.done.text} Upgraded` : (upgrade.tier === currentTier + 1 ? `${EMOJIS.unlock.text} Available` : `${EMOJIS.lock.text} Locked`);
                embed.addFields({ name: `${upgrade.name} [Level ${upgrade.tier}]`, value: `*Capacity: ${upgrade.capacity} objets*\n**Status:** ${status}`, inline: false }).setThumbnail('attachment://craft.png');
            });
            return embed;
        };
        
        const generateBackpackListComponents = () => {
            const menu = new StringSelectMenuBuilder().setCustomId('craft_backpack_select').setPlaceholder('Select an upgrade...').addOptions(BACKPACK_UPGRADES.filter(u => u.tier > 0).map(upgrade => ({ label: `${upgrade.name} [Level ${upgrade.tier}]`, value: upgrade.tier.toString() })));
            const backButton = new ButtonBuilder().setCustomId('back_to_main').setEmoji(EMOJIS.back.id).setLabel('Back').setStyle(ButtonStyle.Secondary);
            return [new ActionRowBuilder().addComponents(menu), new ActionRowBuilder().addComponents(backButton)];
        };

        const generateCraftingEmbedAndComponents = (recipe) => {
            let description = `**Materials:**\n`;
            let canCraft = true;
            for (const [material, requiredQty] of Object.entries(recipe.materials)) {
                const userQty = userProfile.inventory.get(material) || 0;
                const check = userQty >= requiredQty ? `${EMOJIS.check.text}` : `${EMOJIS.close.text}`;
                if (userQty < requiredQty) canCraft = false;
                description += `${check} **${material}:** ${userQty} / ${requiredQty}\n`;
            }
            const embed = new EmbedBuilder().setColor(0xF1C40F).setTitle(`Craft: ${recipe.name}`).setDescription(description).setThumbnail('attachment://craft.png').setFooter({ text: canCraft ? 'You have all the required materials' : 'You are missing some materials' });
            const craftButton = new ButtonBuilder().setCustomId('confirm_craft').setEmoji(EMOJIS.pickaxe.id).setLabel(' Craft object').setStyle(ButtonStyle.Success).setDisabled(!canCraft);
            const backButton = new ButtonBuilder().setCustomId('back_to_recipes').setEmoji(EMOJIS.back.id).setLabel(' Back').setStyle(ButtonStyle.Secondary);
            return { embed, components: [new ActionRowBuilder().addComponents(backButton, craftButton)] };
        };

        // --- Lógica del Collector ---
        const reply = await interaction.editReply({ embeds: [generateMainEmbed()], components: [generateMainComponents()], files: [craftFile] });
        const collector = reply.createMessageComponentCollector({ filter: i => i.user.id === interaction.user.id, time: 60000 });

        collector.on('collect', async i => {
            await i.deferUpdate();
            userProfile = await Profile.findOne({ userId, guildId }); // Recargar perfil

            if (i.customId === 'back_to_main') {
                currentCategory = null; selectedRecipe = null;
                return interaction.editReply({ embeds: [generateMainEmbed()], components: [generateMainComponents()], files: [craftFile] });
            }

            if (i.customId === 'back_to_recipes') {
                selectedRecipe = null;
                if (currentCategory === 'backpacks') {
                    return interaction.editReply({ embeds: [generateBackpackListEmbed()], components: generateBackpackListComponents(), files: [craftFile] });
                } else {
                    return interaction.editReply({ embeds: [generateRecipeListEmbed(currentCategory)], components: generateRecipeComponents(currentCategory), files: [craftFile] });
                }
            }

            if (i.customId === 'craft_category_select') {
                currentCategory = i.values[0];
                if (currentCategory === 'backpacks') {
                    return interaction.editReply({ embeds: [generateBackpackListEmbed()], components: generateBackpackListComponents(), files: [craftFile] });
                }
                return interaction.editReply({ embeds: [generateRecipeListEmbed(currentCategory)], components: generateRecipeComponents(currentCategory), files: [craftFile] });
            }

            if (i.customId === 'craft_backpack_select') {
                const selectedTier = parseInt(i.values[0], 10);
                const currentTier = userProfile.backpackTier || 0;
                if (selectedTier <= currentTier) return i.followUp({ content: 'Your already have this upgrade or superior', ephemeral: true });
                if (selectedTier > currentTier + 1) return i.followUp({ content: 'You need to craft the other ones.', ephemeral: true });
                
                selectedRecipe = BACKPACK_UPGRADES.find(b => b.tier === selectedTier);
                const { embed, components } = generateCraftingEmbedAndComponents(selectedRecipe);
                return interaction.editReply({ embeds: [embed], components, files: [craftFile] });
            }

            if (i.customId === 'craft_recipe_select') {
                const recipeName = i.values[0];
                if (userProfile.arsenal.get(recipeName)) return i.followUp({ content: 'You already crafted this', ephemeral: true });
                
                selectedRecipe = CRAFTING_RECIPES[currentCategory].find(r => r.name === recipeName);
                const { embed, components } = generateCraftingEmbedAndComponents(selectedRecipe);
                return interaction.editReply({ embeds: [embed], components, files: [craftFile] });
            }
            
            if (i.customId === 'confirm_craft') {
                for (const [material, requiredQty] of Object.entries(selectedRecipe.materials)) {
                    if ((userProfile.inventory.get(material) || 0) < requiredQty) return i.followUp({ content: 'Missing materials!', ephemeral: true });
                }
                for (const [material, requiredQty] of Object.entries(selectedRecipe.materials)) {
                    const newQty = userProfile.inventory.get(material) - requiredQty;
                    userProfile.inventory.set(material, newQty);
                }
                
                if (selectedRecipe.capacity) userProfile.backpackTier = selectedRecipe.tier;
                else userProfile.arsenal.set(selectedRecipe.name, true);
                
                userProfile.markModified('inventory');
                userProfile.markModified('arsenal');
                
                await userProfile.save();

                const successEmbed = new EmbedBuilder().setColor(0x2ECC71).setTitle('Crafted!').setDescription(`You have succesfully crafted **1x ${selectedRecipe.name}**.`).setThumbnail('attachment://craft.png');
                await interaction.editReply({ embeds: [successEmbed], components: [], files: [craftFile] });
                collector.stop();
            }
        });

        collector.on('end', (collected, reason) => {
            const fileCloseCraft = new AttachmentBuilder('./images/caution_img.png', { name: 'caution_img.png' });
            const embed = new EmbedBuilder().setColor(0xED4245).setTitle('Session Expired').setDescription('The crafting session has expired and is no longer active because of inactivity\n\nTry using the command again with `/craft`.').setFooter({ text: 'Use your time wisely' }).setThumbnail('attachment://caution_img.png');
            if (reason === 'time') interaction.editReply({ embeds: [embed], components: [], files: [fileCloseCraft] }).catch(() => {});
        });
    },
};
