// commands/utility/help.js

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { EMOJIS } = require('../../gameConfig');

// --- LA BASE DE DATOS DE CONOCIMIENTO COMPLETA ---
const COMMANDS_INFO = {
    "🪙 Economy & Profile": [
        { name: 'profile', description: 'Show your status, reputation, and equipment in the city.' },
        { name: 'bank', description: 'Check the balance of your wallet and bank account.' },
        { name: 'wallet', description: 'Quickly check the money you have on you.' },
        { name: 'deposit', description: 'Safely store your money in the bank.', usage: '`/deposit amount: <number | all>`' },
        { name: 'withdraw', description: 'Withdraw money from the bank for use.', usage: '`/withdraw amount: <number | all>`' },
        { name: 'transfer', description: 'Transfer money securely to another user.', usage: '`/transfer recipient: <@user> amount: <number>`' },
        { name: 'leaderboard', description: 'Show the server\'s leaderboard in an image.' },
    ],
    "🏕️ Survival": [
        { name: 'explore', description: 'Search for items and materials. Beware of dangers!', cooldown: '5 minutes' },
        { name: 'backpack', description: 'Open your equipment center to view and manage your items, weapons, and backpacks.' },
        { name: 'craft', description: 'Use the crafting table to create weapons and upgrade your gear.' },
        { name: 'encargo', description: 'Consult and deliver the daily item sought by the collector.' },
    ],
    "💰 Winings & Risk": [
        { name: 'work', description: 'Perform a random job to earn coins.', cooldown: '1 hour' },
        { name: 'daily', description: 'Claim your daily reward. Keep the streak to earn more!', cooldown: '22 hours' },
        { name: 'rob', description: 'Attempt to mug another user. High risk, high reward.', cooldown: '6 hours' },
    ],
    "🎰 Casino": [
        { name: 'coinflip', description: 'A classic 50/50. Choose heads or tails to double your bet.' },
        { name: 'dice', description: 'Bet on whether the sum of two dice will be higher, lower, or equal to 7.' },
        { name: 'higherlower', description: 'Guess if the next number (1-100) will be higher or lower.' },
        { name: 'slots', description: 'Choose a machine and pull the lever to win big prizes.' },
        { name: 'chicken', description: 'Help a chicken cross the road. The further you go, the more you earn!' },
        { name: 'crash', description: 'Bet on a flight and cash out before the plane leaves with your money.' },
        { name: 'roulette', description: 'Place your bets on the casino roulette table.' },
        { name: 'blackjack', description: 'Try to beat the dealer by reaching 21 without going over.' },
        { name: 'mines', description: 'Discover gems and avoid mines to multiply your bet.' },
        { name: 'race', description: 'Bet on your favorite competitor in a chaotic and exciting race!' },
        { name: 'duel', description: 'Challenge another player to a tactical turn-based duel.' },
    ],
    "🛠️ Moderation": [
        { name: 'setlogs', description: 'Set or disable the moderation logs channel.' },
        { name: 'kick', description: 'Kick a member through a confirmation panel.' },
        { name: 'ban', description: 'Permanently exile a member with message purge options.' },
        { name: 'clear', description: 'Bulk delete messages with advanced filters.', usage: '`/clear amount: <1-100> [user:] [@user] [filter:] [type]`' },
        { name: 'userinfo', description: 'Displays a complete dossier of information about a user.' },
        { name: 'warn', description: 'Issues an official warning to a user.' },
        { name: 'warnings', description: 'Displays and manages a user\'s warning history.' },
        { name: 'lockdown', description: 'Locks or unlocks the current channel for members.' },
    ],
    "🔧 Utility": [
        { name: 'help', description: 'Displays this interactive command guide.' },
        { name: 'embedbuilder', description: 'Creates custom embeds.', usage: 'Use {user} to use your name or your pfp\nUse {user:USER_ID} to tag any user with their @\nUse {user.mention} to mention yourself\nUse {server.name} to use the server name.\nUse {server.icon} to use the server icon\nUse {server.membercount} to put how many members are in the server.\nUse {channel:CHANNEL_ID} to mention any channel\nUse {bot} to mention or use the bot profile\nUse {role:ROLE_ID} to tag any role\nUse {date} to use today\'s date\nUse {time} to use current time.' },
        { name: 'reactionrole', description: 'Manages self-assignable role panels.' },
    ]
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Shows a complete and interactive guide to all the bot commands.'),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: false });

        let currentCategory = null;

        const generateMainEmbed = () => {
            return new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle('Help Command')
                .setDescription('Welcome to the interactive help menu! Use the dropdown below to navigate through command categories and view detailed information about each command.')
                .setThumbnail(interaction.client.user.displayAvatarURL());
        };

        const generateCategoryEmbed = (category) => {
            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle(category)
                .setDescription(`These are the available commands in the **${category.slice(2)}** category.\nSelect one from the menu for more details.`);

            COMMANDS_INFO[category].forEach(cmd => {
                embed.addFields({ name: `/${cmd.name}`, value: cmd.description, inline: false });
            });
            return embed;
        };
        
        const generateComponents = (category) => {
            const categoryMenu = new StringSelectMenuBuilder()
                .setCustomId('help_category_select')
                .setPlaceholder('Search a category...')
                .addOptions(
                    Object.keys(COMMANDS_INFO).map(cat => ({
                        label: cat.slice(2), // Remove emoji from label
                        value: cat,
                        emoji: cat.split(' ')[0],
                    }))
                );

            if (!category) {
                return [new ActionRowBuilder().addComponents(categoryMenu)];
            }

            const commandMenu = new StringSelectMenuBuilder()
                .setCustomId('help_command_select')
                .setPlaceholder('View command details...')
                .addOptions(
                    COMMANDS_INFO[category].map(cmd => ({
                        label: `/${cmd.name}`,
                        description: cmd.description.substring(0, 100),
                        value: cmd.name,
                    }))
                );
            
            return [new ActionRowBuilder().addComponents(categoryMenu), new ActionRowBuilder().addComponents(commandMenu)];
        };

        const reply = await interaction.editReply({ embeds: [generateMainEmbed()], components: generateComponents(null) });
        const collector = reply.createMessageComponentCollector({ filter: i => i.user.id === interaction.user.id, time: 180000 });

        collector.on('collect', async i => {
            if (!i.isStringSelectMenu()) return;
            await i.deferUpdate();

            if (i.customId === 'help_category_select') {
                currentCategory = i.values[0];
                await interaction.editReply({ embeds: [generateCategoryEmbed(currentCategory)], components: generateComponents(currentCategory) });
            }

            if (i.customId === 'help_command_select') {
                const commandName = i.values[0];
                const commandInfo = COMMANDS_INFO[currentCategory].find(cmd => cmd.name === commandName);

                const detailEmbed = new EmbedBuilder()
                    .setColor(0x2ECC71)
                    .setTitle(`Command: /${commandInfo.name}`)
                    .setDescription(commandInfo.description)
                    .addFields(
                        { name: 'Category', value: currentCategory, inline: true },
                        { name: 'Cooldown', value: commandInfo.cooldown || 'None', inline: true }
                    );
                
                if (commandInfo.usage) {
                    detailEmbed.addFields({ name: 'Example Usage', value: `\`${commandInfo.usage}\``, inline: false });
                }

                const backButton = new ButtonBuilder()
                    .setCustomId('back_to_category')
                    .setLabel('Back to List')
                    .setEmoji(EMOJIS.back.id)
                    .setStyle(ButtonStyle.Primary);
                
                await interaction.editReply({ embeds: [detailEmbed], components: [new ActionRowBuilder().addComponents(backButton)] });
                
                const buttonCollector = reply.createMessageComponentCollector({ filter: btn => btn.user.id === i.user.id && btn.customId === 'back_to_category', max: 1, time: 60000 });
                buttonCollector.on('collect', async btnInteraction => {
                    await btnInteraction.update({ embeds: [generateCategoryEmbed(currentCategory)], components: generateComponents(currentCategory) });
                });
            }
        });

        collector.on('end', () => {
            const expiredEmbed = new EmbedBuilder()
                .setColor(0x99AAB5)
                .setTitle('Help Session Expired')
                .setDescription('This help session has expired. Please run the `/help` command again to start a new session.');
            interaction.editReply({ embeds: [expiredEmbed], components: [] }).catch(() => {});
        });
    },
};
