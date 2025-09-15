// commands/survival/explore.js

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Profile = require('../../models/Profile');
// --- FIX: Añadimos RARITY_CHANCES a la importación y cambiamos WEAPON_POWER por WEAPON_STATS ---
const { WEAPON_STATS, ENCOUNTERS, BACKPACK_UPGRADES, EMOJIS, ITEMS_BY_RARITY, RARITY_EMOJIS, RARITY_CHANCES } = require('../../gameConfig');

const EXPLORE_COOLDOWN = 1 * 30 * 1000; // 1.3 minutos (para pruebas)
const ENCOUNTER_CHANCE = 0.25;
const FLEE_SUCCESS_CHANCE = 0.25;

const LOCATION_DATA = {
    calles: { 
        name: 'the Streets', 
        failChance: 0.3, 
        thumbnail: 'https://i.imgur.com/gQkF3tV.png',
        messages: [
            "You found something gleaming in a puddle.",
            "You noticed something sticking out from under a newspaper.",
            "A discarded bag held a surprising item.",
        ],
    },
    parque: { 
        name: 'the Park', 
        failChance: 0.3,
        thumbnail: 'https://i.imgur.com/J5z5q1m.png',
        messages: [
            "You spotted something unusual near the roots of an old tree.",
            "You found an abandoned item on a park bench.",
            "Something was hidden under a pile of leaves.",
        ],
    },
    playa: { 
        name: 'the Beach', 
        failChance: 0.3,
        thumbnail: 'https://i.imgur.com/sZ3a4s1.png',
        messages: [
            "The tide washed up something interesting onto the shore.",
            "You dug in the sand and your hand hit something solid.",
            "Something was tangled in a patch of seaweed.",
        ],
    },
    callejones: { 
        name: 'the Alleys', 
        failChance: 0.4,
        thumbnail: 'https://i.imgur.com/v2y5bVd.png',
        messages: [
            "You found something hidden behind a dumpster.",
            "A loose brick in the wall concealed an item.",
            "You noticed something dropped in the shadows.",
        ],
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('explore')
        .setDescription('Explore the city for items, but be wary of the dangers.')
        .addStringOption(option =>
            option.setName('location')
                .setDescription('The place you want to explore.')
                .setRequired(true)
                .addChoices(
                    { name: '🏙️ Street', value: 'calles' },
                    { name: '🌳 Park', value: 'parque' },
                    { name: '🏖️ Beach', value: 'playa' },
                    { name: '🌆 Alley', value: 'callejones' }
                )),

    async execute(interaction) {
        const locationKey = interaction.options.getString('location');
        const location = LOCATION_DATA[locationKey];
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;

        await interaction.deferReply();

        let userProfile = await Profile.findOne({ userId, guildId });
        if (!userProfile) userProfile = await Profile.create({ userId, guildId });

        const lastExploreTimestamp = userProfile.lastExplore?.getTime() || 0;
        const currentTime = Date.now();
        if (currentTime - lastExploreTimestamp < EXPLORE_COOLDOWN) {
            const remainingTime = EXPLORE_COOLDOWN - (currentTime - lastExploreTimestamp);
            const minutes = Math.floor(remainingTime / 60000);
            const seconds = ((remainingTime % 60000) / 1000).toFixed(0);
            return interaction.editReply(`Enough adventure for now. You can explore again in **${minutes}m and ${seconds}s**.`);
        }
        userProfile.lastExplore = new Date();
        await userProfile.save();

        if (Math.random() < ENCOUNTER_CHANCE) {
            // --- Lógica de Encuentro ---
            const encounter = ENCOUNTERS[Math.floor(Math.random() * ENCOUNTERS.length)];
            const encounterEmbed = new EmbedBuilder().setColor(0xED4245).setTitle(`🚨 DANGER IN ${location.name.toUpperCase()}! 🚨`).setDescription(`While exploring, you run into trouble...\n\n*${encounter.message}*\n\n**What will you do?**`);
            const buttons = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('fight').setLabel('Fight').setEmoji(EMOJIS.punch.id).setStyle(ButtonStyle.Danger), new ButtonBuilder().setCustomId('flee').setLabel('Flee').setEmoji(EMOJIS.run.id).setStyle(ButtonStyle.Secondary));
            const reply = await interaction.editReply({ embeds: [encounterEmbed], components: [buttons] });
            const collector = reply.createMessageComponentCollector({ filter: i => i.user.id === interaction.user.id, time: 30000 });

            collector.on('collect', async i => {
                await i.deferUpdate();
                let outcomeEmbed;
                if (i.customId === 'flee') {
                    if (Math.random() < FLEE_SUCCESS_CHANCE) {
                        outcomeEmbed = new EmbedBuilder().setColor(0x57F287).setTitle('Successful Escape!').setDescription('You managed to slip away and escape just in time. You lost nothing.');
                    } else {
                        const moneyLost = Math.floor(userProfile.wallet * encounter.penaltyPercent);
                        userProfile.wallet -= moneyLost;
                        await userProfile.save();
                        outcomeEmbed = new EmbedBuilder().setColor(0xED4245).setTitle('Escape Failed!').setDescription(`You tried to run, but they caught you. In the struggle, you lost **${moneyLost.toLocaleString()}** coins.`);
                    }
                }
                if (i.customId === 'fight') {
                    const userArsenal = userProfile.arsenal ? Array.from(userProfile.arsenal.keys()) : [];
                        const userBestWeaponPower = userArsenal.reduce((max, weapon) => {
                            const stats = WEAPON_STATS[weapon];
                            if (!stats || !stats.damage) return max;
                            const power = (stats.damage[0] + stats.damage[1]) / 2;
                            return Math.max(max, power);
                        }, 5);

                    const successChance = Math.min((userBestWeaponPower / encounter.requiredPower) * 0.8, 0.95);
                    if (Math.random() < successChance) {
                        outcomeEmbed = new EmbedBuilder().setColor(0x57F287).setTitle('Victory!').setDescription('You used your gear to defend yourself and managed to repel the attacker. Good job!');
                    } else {
                        const moneyLost = Math.floor(userProfile.wallet * encounter.penaltyPercent);
                        userProfile.wallet -= moneyLost;
                        await userProfile.save();
                        let reason = userBestWeaponPower > 5 ? 'Despite your effort, your opponent was too strong.' : 'You had nothing to defend yourself with and were an easy target.';
                        outcomeEmbed = new EmbedBuilder().setColor(0xED4245).setTitle('Defeat!').setDescription(`${reason}\nYou lost **${moneyLost.toLocaleString()}** coins.`);
                    }
                }
                await interaction.editReply({ embeds: [outcomeEmbed], components: [] });
                collector.stop();
            });
            collector.on('end', (collected, reason) => {
                if (reason === 'time') {
                    interaction.editReply({ content: 'You took too long to decide and the attacker took advantage...', components: [] });
                }
            });
        } else {
            // --- Lógica de Exploración Pacífica ---
            if (Math.random() < location.failChance) {
                const failEmbed = new EmbedBuilder().setTitle(`Exploring ${location.name}...`).setColor(0x8B4513).setDescription('You searched everywhere, but found nothing of interest this time.');
                return interaction.editReply({ embeds: [failEmbed] });
            }

            const random = Math.random();
            let foundRarityInfo = RARITY_CHANCES.find(r => random <= r.chance);
            const itemsInRarity = ITEMS_BY_RARITY[foundRarityInfo.rarity];
            const foundItem = itemsInRarity[Math.floor(Math.random() * itemsInRarity.length)];
            const rarityEmoji = RARITY_EMOJIS[foundRarityInfo.rarity] || '📦';

            const currentTier = userProfile.backpackTier || 0;
            const backpackCapacity = BACKPACK_UPGRADES[currentTier].capacity;
            const currentItemCount = Array.from(userProfile.inventory.entries()).filter(([,q])=>q>0).length;
            const alreadyHasItem = userProfile.inventory.has(foundItem.name);

            if (currentItemCount >= backpackCapacity && !alreadyHasItem) {
                const fullEmbed = new EmbedBuilder().setColor(0xFEE75C).setTitle('Backpack Full!').setDescription(`You found ${rarityEmoji} **1x ${foundItem.name}**, but had no space for **new** items. Consider upgrading your backpack or selling something!`);
                return interaction.editReply({ embeds: [fullEmbed] });
            }

            const currentAmount = userProfile.inventory.get(foundItem.name) || 0;
            userProfile.inventory.set(foundItem.name, currentAmount + 1);
            userProfile.markModified('inventory');
            await userProfile.save();
            
            const randomMessage = location.messages[Math.floor(Math.random() * location.messages.length)];

            const successEmbed = new EmbedBuilder()
                .setTitle(`You found something! [${foundRarityInfo.rarity.toUpperCase()}]`)
                .setColor(foundRarityInfo.color)
                .setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL() })
                .setThumbnail(location.thumbnail)
                .setDescription(`${randomMessage}\n\nYou obtained **${rarityEmoji} 1x ${foundItem.name}**!`);
            await interaction.editReply({ embeds: [successEmbed] });
        }
    },
};
