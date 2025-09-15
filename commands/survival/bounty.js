const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Profile = require('../../models/Profile');
const Bounty = require('../../models/Bounty');
const { EMOJIS } = require('../../gameConfig')

const BOUNTY_ITEMS = [
    { name: 'Paper', baseValue: 10 },
    { name: 'Metal piece', baseValue: 25 },
    { name: 'Plastic', baseValue: 8 },
    { name: 'Smooth stone', baseValue: 22 },
    { name: 'Leather', baseValue: 150 },
    { name: 'Steel plate', baseValue: 200 },

    { name: 'Carbon fiber', baseValue: 790 },
    { name: 'Sharp rock', baseValue: 1401 },
    { name: 'Advanced thread', baseValue: 1080 },
    { name: 'Old zippo', baseValue: 3670 },
    { name: 'Rolled steel', baseValue: 21000 },
    { name: 'Strong wood', baseValue: 15690 },
    { name: 'Golden ant', baseValue: 100000 },
];

// --- FUNCIONES AUXILIARES ---

// Genera un nuevo encargo para el servidor
async function generateNewBounty(guildId) {
    const randomItem = BOUNTY_ITEMS[Math.floor(Math.random() * BOUNTY_ITEMS.length)];
    const reward = randomItem.baseValue * (Math.floor(Math.random() * 6) + 5);

    return await Bounty.findOneAndUpdate(
        { guildId },
        { itemName: randomItem.name, reward, lastReset: new Date() },
        { upsert: true, new: true }
    );
}

// Crea el embed de visualización del encargo
function createBountyEmbed(bounty, userProfile) {
    const userHasCompleted = userProfile?.lastBountyClaim > bounty.lastReset;
    const statusText = userHasCompleted ? ` ${EMOJIS.done.text} Delivered` : `${EMOJIS.waiting.text} Undelivered`;
    const embedColor = userHasCompleted ? 0x2ECC71 : 0xE67E22;

    return new EmbedBuilder()
        .setColor(embedColor)
        .setTitle('Daily bounty')
        .setDescription('The collector has posted a new bounty. Here’s what they’re looking for today!')
        .addFields(
            { name: 'Item Sought', value: `**${bounty.itemName}**`, inline: true },
            { name: `Reward ${EMOJIS.coinbag.text}`, value: `**${bounty.reward.toLocaleString()}** ${EMOJIS.coin.text}`, inline: true },
            { name: 'Your Status', value: `**${statusText}**`, inline: false }
        )
        .setFooter({ text: 'The bounty resets every 24 hours.' });
}


module.exports = {
    data: new SlashCommandBuilder()
        .setName('bounty')
        .setDescription('Interact with the collector’s daily bounties.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('see')
                .setDescription('Show the daily bounty.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('deliver')
                .setDescription('Deliver the item from the bounty to receive your reward.')),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;

        await interaction.deferReply();

        // --- LÓGICA PARA /encargo ver ---
        if (subcommand === 'see') {
            try {
                let currentBounty = await Bounty.findOne({ guildId });
                const userProfile = await Profile.findOne({ userId, guildId });
                const now = new Date();

                if (!currentBounty || (now - currentBounty.lastReset > 24 * 60 * 60 * 1000)) {
                    currentBounty = await generateNewBounty(guildId);
                }

                const embed = createBountyEmbed(currentBounty, userProfile);
                return interaction.editReply({ embeds: [embed] });

            } catch (error) {
                console.error('There was an error in /bounty see:', error);
                const errorEmbed = new EmbedBuilder()
                    .setColor(0xE74C3C)
                    .setDescription(`${EMOJIS.error.text} There was an error while fetching the bounty. Please try again later.`);
                return interaction.editReply({ embeds: [errorEmbed] });
            }
        }

        // --- LÓGICA PARA /bounty deliver ---
        if (subcommand === 'deliver') {
            try {
                const [userProfile, currentBounty] = await Promise.all([
                    Profile.findOne({ userId, guildId }),
                    Bounty.findOne({ guildId })
                ]);

                if (!currentBounty || (new Date() - currentBounty.lastReset > 24 * 60 * 60 * 1000)) {
                     return interaction.editReply(`${EMOJIS.caution.text} The bounty for today has expired. Use \`/bounty see\` to check the new one.`);
                }
                
                if (userProfile?.lastBountyClaim > currentBounty.lastReset) {
                    const embed = createBountyEmbed(currentBounty, userProfile);
                    embed.setDescription(`${EMOJIS.caution.text} You have already completed today’s bounty. Come back later.`);
                    return interaction.editReply({ embeds: [embed] });
                }

                const itemInInventory = userProfile?.inventory?.get(currentBounty.itemName);

                if (!itemInInventory || itemInInventory < 1) {
                    const embed = createBountyEmbed(currentBounty, userProfile);
                    embed.setDescription(`${EMOJIS.caution.text} You don't have the required item. The collector is looking for **${currentBounty.itemName}**.`);
                    return interaction.editReply({ embeds: [embed] });
                }

                // Update inventory and wallet
                userProfile.inventory.set(currentBounty.itemName, itemInInventory - 1);
                userProfile.wallet += currentBounty.reward;
                userProfile.lastBountyClaim = new Date();
                await userProfile.save();

                const embed = new EmbedBuilder()
                    .setColor(0x2ECC71)
                    .setTitle(`${EMOJIS.check.text} Bounty Delivered!`)
                    .setDescription(`You delivered **1x ${currentBounty.itemName}** to the collector.`)
                    .addFields(
                        { name: 'Reward Received', value: `${EMOJIS.coinbag.text} **+${currentBounty.reward.toLocaleString()}** ${EMOJIS.coin.text}` }
                    );

                return interaction.editReply({ embeds: [embed] });

            } catch (error) {
                console.error('Error en /encargo entregar:', error);
                return interaction.editReply('Hubo un error al entregar el encargo.');
            }
        }
    },
};
