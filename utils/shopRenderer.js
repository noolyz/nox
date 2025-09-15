const { createCanvas, registerFont, loadImage } = require('canvas');
const path = require('path');
const { RARITY_EMOJIS } = require('../gameConfig');

// --- Carga de la Fuente ---
try {
    const fontPath = path.join(__dirname, '..', 'fonts', 'Poppins-Bold.ttf');
    registerFont(fontPath, { family: 'Poppins' });
} catch (error) {
    console.warn("ADVERTENCIA: No se pudo cargar la fuente 'Poppins-Bold.ttf'. Se usará una fuente por defecto.");
}

// Función para dibujar rectángulos con bordes redondeados
function roundRect(ctx, x, y, width, height, radius, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    if (fill) { ctx.fill(); }
    if (stroke) { ctx.stroke(); }
}

async function generateShopImage(shopItems) {
    const canvasWidth = 900;
    const canvasHeight = 500;
    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');

    // Fondo
    ctx.fillStyle = '#2C2F33';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const cardWidth = 280;
    const cardHeight = 220;
    const gap = 20;

    // --- LÓGICA DE CENTRADO CORREGIDA ---
    const totalGridWidth = (3 * cardWidth) + (2 * gap);
    const startX = (canvasWidth - totalGridWidth) / 2;
    const startY = (canvasHeight - (2 * cardHeight + gap)) / 2;


    for (let i = 0; i < shopItems.length; i++) {
        const item = shopItems[i];
        const row = Math.floor(i / 3);
        const col = i % 3;
        const x = startX + col * (cardWidth + gap);
        const y = startY + row * (cardHeight + gap);
        
        ctx.fillStyle = item.isDealOfTheDay ? '#3C3A2E' : '#36393F';
        roundRect(ctx, x, y, cardWidth, cardHeight, 10, true, false);

        if (item.isDealOfTheDay) {
            ctx.strokeStyle = '#FAD961';
            ctx.lineWidth = 4;
            roundRect(ctx, x, y, cardWidth, cardHeight, 10, false, true);
        }
        
        await drawCardContent(ctx, item, x, y, cardWidth, cardHeight, item.isDealOfTheDay);
    }

    return canvas.toBuffer('image/png');
}

async function drawCardContent(ctx, item, x, y, width, height, isDeal) {
    ctx.textAlign = 'center';
    
    // Icono de Rareza
    const rarityData = RARITY_EMOJIS[item.rarity];
    if (rarityData && rarityData.url) {
        try {
            const image = await loadImage(rarityData.url);
            const imageSize = 56;
            ctx.drawImage(image, x + (width / 2) - (imageSize / 2), y + 25, imageSize, imageSize);
        } catch (e) { console.error(`Failed to load rarity image for ${item.rarity}`); }
    }

    // Nombre
    ctx.font = 'bold 22px Poppins, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(item.name.toUpperCase(), x + width / 2, y + 120, width - 20);

    // Precio y Stock
    ctx.font = 'bold 20px Poppins, sans-serif';
    if (item.stock > 0) {
        ctx.fillStyle = isDeal ? '#FAD961' : '#57F287';
        ctx.fillText(`${item.price.toLocaleString()} coins`, x + width / 2, y + height - 55);
        
        ctx.font = '18px Poppins, sans-serif';
        ctx.fillStyle = '#B9BBBE';
        ctx.fillText(`${item.stock} in stock`, x + width / 2, y + height - 30);
    } else {
        ctx.fillStyle = '#ED4245';
        ctx.font = 'bold 22px Poppins, sans-serif';
        ctx.fillText('Sold out', x + width / 2, y + height - 40);
    }
    
    // Distintivo "Oferta del Día"
    if (isDeal) {
        ctx.save();
        ctx.translate(x, y);
        ctx.fillStyle = '#FAD961';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(110, 0);
        ctx.lineTo(0, 110);
        ctx.closePath();
        ctx.fill();

        ctx.rotate(-Math.PI / 4);
        ctx.font = 'bold 16px Poppins, sans-serif';
        ctx.fillStyle = '#4b4a48de';
        ctx.textAlign = 'center';
        // Coordenadas ajustadas para centrar el texto
        ctx.fillText('On sale', 2, 58); 
        ctx.restore();
    }
}

module.exports = { generateShopImage };

