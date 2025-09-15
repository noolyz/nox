const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');
const Profile = require('../../models/Profile');
const Crypto = require('../../models/Crypto');
const MarketState = require('../../models/MarketState');
const { CRYPTOCURRENCIES, CRYPTO_MARKET_CONFIG, ECONOMY_EMOJIS } = require('../../gameConfig');

// --- Carga de la Fuente ---
try {
    const fontPath = path.join(__dirname, '..', '..', 'fonts', 'Poppins-Bold.ttf');
    registerFont(fontPath, { family: 'Poppins' });
} catch (error) { console.warn("ADVERTENCIA: No se pudo cargar la fuente 'Poppins-Bold.ttf'."); }

// --- Motor del Mercado ---
async function updateMarket() {
    if (!CRYPTO_MARKET_CONFIG) { console.error("Error Crítico: CRYPTO_MARKET_CONFIG no está definido."); return; }

    let marketStateDoc = await MarketState.findOneAndUpdate(
        { stateId: 'main_market' },
        { $setOnInsert: { stateId: 'main_market', currentState: 'stable', lastStateChange: new Date() } },
        { upsert: true, new: true }
    );
    if (Date.now() - marketStateDoc.lastStateChange.getTime() > CRYPTO_MARKET_CONFIG.stateChangeInterval) {
        const states = ['bull', 'bear', 'volatile', 'stable'];
        marketStateDoc.currentState = states[Math.floor(Math.random() * states.length)];
        marketStateDoc.lastStateChange = new Date();
        await marketStateDoc.save();
    }
    const marketState = marketStateDoc.currentState;

    for (const company of CRYPTOCURRENCIES) {
        let crypto = await Crypto.findOneAndUpdate(
            { ticker: company.ticker },
            { $setOnInsert: { name: company.name, price: company.initialPrice, history: [company.initialPrice], lastUpdate: new Date(0) } },
            { upsert: true, new: true }
        );
        if (crypto.lastUpdate && (Date.now() - crypto.lastUpdate.getTime() < CRYPTO_MARKET_CONFIG.updateInterval)) continue;
        let trend = 0;
        if (marketState === 'bull') trend = 0.02;
        if (marketState === 'bear') trend = -0.02;
        const volatility = marketState === 'volatile' ? company.volatility * 2.5 : company.volatility;
        const randomFactor = (Math.random() * 2 - 1) * volatility;
        const changePercent = trend + randomFactor;
        let newPrice = crypto.price * (1 + changePercent);
        newPrice = Math.max(1, Math.round(newPrice));
        crypto.price = newPrice;
        crypto.history.push(newPrice);
        if (crypto.history.length > CRYPTO_MARKET_CONFIG.historyLength) { crypto.history.shift(); }
        crypto.lastUpdate = new Date();
        await crypto.save();
    }
}

// --- Motor de Renderizado ---
async function generateMarketImage(cryptos, marketState) {
    const canvasWidth = 800, canvasHeight = 700, ctx = createCanvas(canvasWidth, canvasHeight).getContext('2d');
    ctx.fillStyle = '#1E1F22'; ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    ctx.font = 'bold 28px Poppins, sans-serif'; ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center';
    ctx.fillText(`DDEX Terminal | Mercado en: ${marketState.toUpperCase()}`, canvasWidth / 2, 40);
    const rowHeight = 100, startY = 80;
    for (let i = 0; i < cryptos.length; i++) {
        const crypto = cryptos[i], company = CRYPTOCURRENCIES.find(c => c.ticker === crypto.ticker), y = startY + i * rowHeight;
        ctx.fillStyle = '#2C2F33'; ctx.fillRect(20, y, canvasWidth - 40, rowHeight - 10);
        if (company && company.logo) { try { const logo = await loadImage(company.logo); ctx.drawImage(logo, 30, y + 15, 60, 60); } catch (e) {} }
        ctx.textAlign = 'left'; ctx.font = 'bold 24px Poppins, sans-serif'; ctx.fillStyle = '#FFFFFF';
        ctx.fillText(crypto.name, 110, y + 35);
        ctx.font = '20px Poppins, sans-serif'; ctx.fillStyle = '#B9BBBE'; ctx.fillText(crypto.ticker, 110, y + 65);
        const oldPrice = crypto.history[crypto.history.length - 2] || crypto.price, change = crypto.price - oldPrice, changePercent = (oldPrice === 0 ? 0 : (change / oldPrice)) * 100, isUp = change >= 0;
        ctx.textAlign = 'right'; ctx.font = 'bold 26px Poppins, sans-serif'; ctx.fillStyle = '#FFFFFF';
        ctx.fillText(`${crypto.price.toLocaleString()} ${ECONOMY_EMOJIS.coin.text}`, canvasWidth - 250, y + 50);
        ctx.font = 'bold 20px Poppins, sans-serif'; ctx.fillStyle = isUp ? '#2ECC71' : '#E74C3C';
        ctx.fillText(`${isUp ? '▲' : '▼'} ${change.toFixed(0)} (${changePercent.toFixed(2)}%)`, canvasWidth - 40, y + 50);
    }
    return canvas.toBuffer('image/png');
}
async function generatePortfolioImage(user, portfolio, allCryptos) {
    const canvasHeight = 180 + (portfolio.size * 80), canvasWidth = 800, ctx = createCanvas(canvasWidth, canvasHeight).getContext('2d');
    ctx.fillStyle = '#1E1F22'; ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    ctx.font = 'bold 28px Poppins, sans-serif'; ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center';
    ctx.fillText(`Wallet de ${user.username}`, canvasWidth / 2, 40);
    let totalValue = 0, i = 0;
    for (const [ticker, quantity] of portfolio.entries()) {
        const crypto = allCryptos.find(s => s.ticker === ticker); if (!crypto) continue;
        const value = crypto.price * quantity; totalValue += value; const y = 100 + i * 80;
        ctx.textAlign = 'left'; ctx.font = 'bold 24px Poppins, sans-serif'; ctx.fillStyle = '#FFFFFF';
        ctx.fillText(`${quantity}x ${crypto.name} (${ticker})`, 40, y);
        ctx.textAlign = 'right'; ctx.font = '22px Poppins, sans-serif';
        ctx.fillText(`Valor: ${value.toLocaleString()} ${ECONOMY_EMOJIS.coin.text}`, canvasWidth - 40, y);
        i++;
    }
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(40, 100 + i * 80 - 20); ctx.lineTo(canvasWidth - 40, 100 + i * 80 - 20); ctx.stroke();
    ctx.textAlign = 'right'; ctx.font = 'bold 28px Poppins, sans-serif';
    ctx.fillText(`Valor Total: ${totalValue.toLocaleString()} ${ECONOMY_EMOJIS.coin.text}`, canvasWidth - 40, 140 + i * 80 - 20);
    return canvas.toBuffer('image/png');
}

// --- Comando Principal ---
module.exports = {
    data: new SlashCommandBuilder().setName('crypto').setDescription('Interactúa con el DryneNet Decentralized Exchange (DDEX).')
        .addSubcommand(sub => sub.setName('ver').setDescription('Ver el mercado o un portafolio.').addStringOption(opt => opt.setName('que_ver').setDescription('Elige qué quieres ver.').addChoices({ name: 'Mercado', value: 'mercado' }, { name: 'Mi Wallet', value: 'portafolio' })).addUserOption(opt => opt.setName('usuario').setDescription('Ver el wallet de otro usuario.')))
        .addSubcommand(sub => sub.setName('comprar').setDescription('Compra tokens.').addStringOption(opt => opt.setName('ticker').setDescription('El ticker del token (ej: NOX).').setRequired(true).setAutocomplete(true)).addIntegerOption(opt => opt.setName('cantidad').setDescription('La cantidad de tokens a comprar.').setRequired(true)))
        .addSubcommand(sub => sub.setName('vender').setDescription('Vende tus tokens.').addStringOption(opt => opt.setName('ticker').setDescription('El ticker del token que quieres vender.').setRequired(true).setAutocomplete(true)).addIntegerOption(opt => opt.setName('cantidad').setDescription('La cantidad de tokens a vender.').setRequired(true))),
    
    async autocomplete(interaction) {
        try {
            const focused = interaction.options.getFocused(true); let choices = [];
            if (focused.name === 'ticker') {
                const sub = interaction.options.getSubcommand();
                if (sub === 'comprar') { choices = CRYPTOCURRENCIES.map(c => c.ticker); } 
                else if (sub === 'vender') {
                    const profile = await Profile.findOne({ userId: interaction.user.id, guildId: interaction.guild.id }).lean();
                    if (profile && profile.portfolio) { choices = [...profile.portfolio.keys()]; }
                }
            }
            const filtered = choices.filter(c => c.toLowerCase().startsWith(focused.value.toLowerCase())).slice(0, 25);
            await interaction.respond(filtered.map(c => ({ name: c, value: c })));
        } catch (error) { console.error("Error en autocompletado de crypto:", error); }
	},
    async execute(interaction) {
        if (!CRYPTO_MARKET_CONFIG || !CRYPTOCURRENCIES || !ECONOMY_EMOJIS) {
            return interaction.reply({ content: '❌ Error de configuración interna. El comando de crypto está desactivado.', ephemeral: true });
        }
        await interaction.deferReply();
        await updateMarket();
        const sub = interaction.options.getSubcommand(), userId = interaction.user.id, guildId = interaction.guild.id;
        const profile = await Profile.findOne({ userId, guildId });
        if (!profile) { return interaction.editReply('Primero necesitas un perfil. ¡Usa `/profile` para empezar!'); }
        if (sub === 'ver') {
            const targetUser = interaction.options.getUser('usuario'), viewType = interaction.options.getString('que_ver');
            if (targetUser) {
                const targetProfile = await Profile.findOne({ userId: targetUser.id, guildId }).lean();
                if (!targetProfile || !targetProfile.portfolio || targetProfile.portfolio.size === 0) { return interaction.editReply(`${targetUser.username} no tiene tokens en su wallet.`); }
                const allCryptos = await Crypto.find().lean();
                const img = await generatePortfolioImage(targetUser, targetProfile.portfolio, allCryptos);
                const attachment = new AttachmentBuilder(img, { name: 'portfolio.png' });
                const embed = new EmbedBuilder().setColor(0x00FFFF).setTitle(`Wallet de ${targetUser.username}`).setImage('attachment://portfolio.png');
                await interaction.editReply({ embeds: [embed], files: [attachment] });
            } else if (viewType === 'portafolio') {
                if (!profile.portfolio || profile.portfolio.size === 0) { return interaction.editReply('No tienes tokens en tu wallet. ¡Usa `/crypto comprar` para empezar!'); }
                const allCryptos = await Crypto.find().lean();
                const img = await generatePortfolioImage(interaction.user, profile.portfolio, allCryptos);
                const attachment = new AttachmentBuilder(img, { name: 'portfolio.png' });
                const embed = new EmbedBuilder().setColor(0x00FFFF).setTitle('Tu Wallet de Criptomonedas').setImage('attachment://portfolio.png');
                await interaction.editReply({ embeds: [embed], files: [attachment] });
            } else {
                const cryptos = await Crypto.find().lean();
                const marketState = await MarketState.findOne({ stateId: 'main_market' }).lean();
                const img = await generateMarketImage(cryptos, marketState.currentState);
                const attachment = new AttachmentBuilder(img, { name: 'market.png' });
                const embed = new EmbedBuilder().setColor(0x00FFFF).setTitle('DryneNet Decentralized Exchange (DDEX)').setImage('attachment://market.png');
                await interaction.editReply({ embeds: [embed], files: [attachment] });
            }
        } else if (sub === 'comprar') {
            const ticker = interaction.options.getString('ticker').toUpperCase(), amount = interaction.options.getInteger('cantidad');
            const crypto = await Crypto.findOne({ ticker }).lean();
            if (!CRYPTOCURRENCIES.some(c => c.ticker === ticker)) return interaction.editReply({ content: 'Ese ticker no es válido.', ephemeral: true });
            if (!crypto) return interaction.editReply({ content: 'Esa criptomoneda no existe en el mercado.', ephemeral: true });
            if (amount <= 0) return interaction.editReply({ content: 'La cantidad debe ser positiva.', ephemeral: true });
            const totalPrice = crypto.price * amount;
            if (profile.wallet < totalPrice) { return interaction.editReply({ content: `No tienes suficientes monedas. Necesitas **${totalPrice.toLocaleString()}** ${ECONOMY_EMOJIS.coin.text}.`, ephemeral: true }); }
            profile.wallet -= totalPrice;
            profile.portfolio.set(ticker, (profile.portfolio.get(ticker) || 0) + amount);
            profile.markModified('portfolio');
            await profile.save();
            await interaction.editReply(`✅ ¡Compra exitosa! Has adquirido **${amount}** token(s) de **${crypto.name} (${ticker})** por **${totalPrice.toLocaleString()}** ${ECONOMY_EMOJIS.coin.text}.`);
        } else if (sub === 'vender') {
            const ticker = interaction.options.getString('ticker').toUpperCase(), amount = interaction.options.getInteger('cantidad');
            const owned = profile.portfolio.get(ticker) || 0;
            if (owned < amount) { return interaction.editReply({ content: `No tienes suficientes tokens. Solo posees **${owned}** de **${ticker}**.`, ephemeral: true }); }
            if (amount <= 0) return interaction.editReply({ content: 'La cantidad debe ser positiva.', ephemeral: true });
            const crypto = await Crypto.findOne({ ticker }).lean();
            const totalPrice = crypto.price * amount, commission = Math.round(totalPrice * CRYPTO_MARKET_CONFIG.commissionFee), finalPrice = totalPrice - commission;
            profile.wallet += finalPrice;
            if (owned - amount === 0) { profile.portfolio.delete(ticker); } 
            else { profile.portfolio.set(ticker, owned - amount); }
            profile.markModified('portfolio');
            await profile.save();
            await interaction.editReply(`✅ ¡Venta exitosa! Has vendido **${amount}** token(s) de **${crypto.name} (${ticker})** por **${finalPrice.toLocaleString()}** ${ECONOMY_EMOJIS.coin.text} (después de una Gas Fee de ${commission.toLocaleString()}).`);
        }
    }
};

