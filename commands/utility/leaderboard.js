// commands/utility/leaderboard.js

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, AttachmentBuilder } = require('discord.js');
const Profile = require('../../models/Profile');
const { createCanvas, loadImage } = require('canvas');

// --- Función de ayuda para dibujar rectángulos redondeados ---
function roundRect(ctx, x, y, width, height, radius) {
  if (width < 2 * radius) radius = width / 2;
  if (height < 2 * radius) radius = height / 2;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
  return ctx;
}

const generateLeaderboardImage = async (category, allProfiles, interaction) => {
    let sortedProfiles;
    let title, valueFormatter, valueEmoji;

    // Lógica de ordenamiento
    switch (category) {
        case 'wealth':
            title = 'Wealth';
            sortedProfiles = allProfiles.sort((a, b) => ((b.wallet || 0) + (b.bank || 0)) - ((a.wallet || 0) + (a.bank || 0)));
            valueFormatter = (p) => `${((p.wallet || 0) + (p.bank || 0)).toLocaleString()}`;
            valueEmoji = '💰'; // Emoji para riqueza
            break;
        default: // reputation
            title = 'Reputation';
            const profilesWithRep = allProfiles.map(p => {
                const totalMoney = (p.wallet || 0) + (p.bank || 0);
                const moneyRep = Math.floor(totalMoney / 500);
                const equipmentRep = ((p.arsenal?.size || 0) * 50) + ((p.backpackTier || 0) * 25);
                const activityRep = (p.dailyStreak || 0) * 10;
                return { ...p, reputation: moneyRep + equipmentRep + activityRep };
            });
            sortedProfiles = profilesWithRep.sort((a, b) => b.reputation - a.reputation);
            valueFormatter = (p) => `${(p.reputation || 0).toLocaleString()}`;
            valueEmoji = '🌟'; // Emoji para reputación
            break;
    }

    const top10 = sortedProfiles.slice(0, 10);

    // --- NUEVO DISEÑO MINIMALISTA ---
    const canvasWidth = 800;
    const canvasHeight = 40 + (10 * (55 + 5)); 
    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');

    // Fondo oscuro de Discord
    ctx.fillStyle = '#2b2d31';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Dibujar el Top 10
    const startY = 30;
    const itemHeight = 55;
    const itemGap = 5;
    for (let i = 0; i < top10.length; i++) {
        const userProfile = top10[i];
        const y = startY + i * (itemHeight + itemGap);

        // Fondo de la tarjeta semi-circular (píldora)
        if (i < 3) {
            const gradient = ctx.createLinearGradient(0, y, canvasWidth, y);
            if (i === 0) { gradient.addColorStop(0, 'rgba(255, 215, 0, 0.2)'); gradient.addColorStop(1, 'rgba(255, 215, 0, 0.0)'); } // Oro
            if (i === 1) { gradient.addColorStop(0, 'rgba(192, 192, 192, 0.2)'); gradient.addColorStop(1, 'rgba(192, 192, 192, 0.0)'); } // Plata
            if (i === 2) { gradient.addColorStop(0, 'rgba(205, 127, 50, 0.2)'); gradient.addColorStop(1, 'rgba(205, 127, 50, 0.0)'); } // Bronce
            ctx.fillStyle = gradient;
        } else {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        }
        roundRect(ctx, 20, y - itemHeight / 2, canvasWidth - 40, itemHeight, itemHeight / 2).fill();

        const user = await interaction.client.users.fetch(userProfile.userId).catch(() => null);
        if (!user) continue;

        // Rank
        const rank = i + 1;
        ctx.font = 'bold 28px "Segoe UI"';
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'left';
        ctx.fillText(`#${rank}`, 50, y + 8);

        // Avatar
        ctx.save();
        ctx.beginPath();
        ctx.arc(140, y + 2.5, 20, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.clip();
        const avatar = await loadImage(user.displayAvatarURL({ extension: 'png', size: 128 }));
        ctx.drawImage(avatar, 120, y - 17.5, 40, 40);
        ctx.restore();

        // Username
        ctx.font = '24px "Segoe UI"';
        ctx.fillStyle = '#CCCCCC';
        ctx.fillText(user.username, 180, y + 9);

        // Score con emoji
        ctx.font = 'bold 26px "Segoe UI"';
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'right';
        // --- CAMBIO AQUÍ: Añadimos el emoji al final del texto ---
        const scoreText = `${valueFormatter(userProfile)} ${valueEmoji}`;
        ctx.fillText(scoreText, canvasWidth - 50, y + 10);
    }

    return new AttachmentBuilder(canvas.toBuffer('image/png'), { name: 'leaderboard.png' });
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('Show the server leaderboard as an image.'),

    async execute(interaction) {
        await interaction.deferReply();

        const allProfiles = await Profile.find({ guildId: interaction.guild.id }).lean();
        if (allProfiles.length === 0) {
            return interaction.editReply('No data available to display on the leaderboard.');
        }

        let currentCategory = 'reputation';

        const generateComponents = () => {
            const menu = new StringSelectMenuBuilder()
                .setCustomId('leaderboard_select')
                .setPlaceholder('Select Category...')
                .addOptions(
                    { label: 'Reputation', value: 'reputation', emoji: '🌟' },
                    { label: 'Wealth', value: 'wealth', emoji: '💰' },
                );
            return new ActionRowBuilder().addComponents(menu);
        };

        const attachment = await generateLeaderboardImage(currentCategory, allProfiles, interaction);
        const embed = new EmbedBuilder()
            .setColor(0x2b2d31)
            .setTitle(`Leaderboard - ${currentCategory === 'reputation' ? 'Reputation' : 'Wealth'}`)
            .setImage('attachment://leaderboard.png');

        const reply = await interaction.editReply({ embeds: [embed], files: [attachment], components: [generateComponents()] });
        const collector = reply.createMessageComponentCollector({ filter: i => i.user.id === interaction.user.id, time: 180000 });

        collector.on('collect', async i => {
            if (!i.isStringSelectMenu()) return;
            await i.deferUpdate();
            currentCategory = i.values[0];
            
            const newAttachment = await generateLeaderboardImage(currentCategory, allProfiles, interaction);
            const newEmbed = new EmbedBuilder()
                .setColor(0x2b2d31)
                .setTitle(`Leaderboard - ${currentCategory === 'reputation' ? 'Reputation' : 'Wealth'}`)
                .setImage('attachment://leaderboard.png');
            await interaction.editReply({ embeds: [newEmbed], files: [newAttachment], components: [generateComponents()] });
        });

        collector.on('end', () => {
            interaction.editReply({ components: [] }).catch(() => {});
        });
    },
};