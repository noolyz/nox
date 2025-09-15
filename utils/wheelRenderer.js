const { createCanvas, registerFont } = require('canvas');
const GIFEncoder = require('gif-encoder-2');
const { WHEEL_OF_FORTUNE } = require('../gameConfig');
const path = require('path');

// --- Carga de la Fuente ---
try {
    const fontPath = path.join(__dirname, '..', 'fonts', 'Poppins-Bold.ttf');
    registerFont(fontPath, { family: 'Poppins' });
} catch (error) {
    console.warn("ADVERTENCIA: No se pudo cargar la fuente 'Poppins-Bold.ttf' desde la carpeta 'fonts'.");
    console.warn("El diseño de la ruleta utilizará una fuente por defecto y no se verá como el diseño previsto.");
}

const WIDTH = 400;
const HEIGHT = 400;
const CENTER = WIDTH / 2;

// --- Funciones de Dibujo de Precisión ---

async function drawWheel(ctx, rotationAngle = 0) {
    const segments = WHEEL_OF_FORTUNE.default.segments;
    const segmentCount = segments.length;
    const segmentAngle = (2 * Math.PI) / segmentCount;
    const wheelRadius = CENTER - 20;

    ctx.save();
    ctx.translate(CENTER, CENTER);
    ctx.rotate(rotationAngle);
    
    // 1. Dibuja los Segmentos de la Rueda
    segments.forEach((segment, i) => {
        const startAngle = i * segmentAngle - (Math.PI / 2) - (segmentAngle / 2);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, wheelRadius, startAngle, startAngle + segmentAngle);
        ctx.closePath();
        ctx.fillStyle = segment.color;
        ctx.fill();
    });
    
    // 2. Dibuja el Borde Exterior
    ctx.beginPath();
    ctx.arc(0, 0, wheelRadius, 0, Math.PI * 2);
    ctx.strokeStyle = '#C2C5A5'; // Verde Salvia
    ctx.lineWidth = 8;
    ctx.stroke();

    // 3. Dibuja el Texto Horizontal
    ctx.font = 'bold 20px Poppins, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    segments.forEach((segment, i) => {
        const textAngle = i * segmentAngle;
        
        // --- AJUSTE PRECISO PARA EL TEXTO "JACKPOT" ---
        // Si el texto es 'JACKPOT', lo dibujamos un poco más cerca del centro.
        const textRadius = segment.name === 'JACKPOT' ? wheelRadius * 0.60 : wheelRadius * 0.7;
        
        ctx.save();
        ctx.rotate(textAngle);
        ctx.fillStyle = '#5A5A5A'; 
        ctx.fillText(segment.name, textRadius, 0);
        ctx.restore();
    });
    
    ctx.restore(); 

    // 4. Dibuja el Eje Central
    ctx.beginPath();
    ctx.arc(CENTER, CENTER, 25, 0, Math.PI * 2);
    ctx.fillStyle = '#F0EAD6'; // Crema
    ctx.fill();
    ctx.beginPath();
    ctx.arc(CENTER, CENTER, 20, 0, Math.PI * 2);
    ctx.fillStyle = '#FAD961'; // Amarillo Dorado
    ctx.fill();

    // 5. Dibuja los Remaches (POSICIÓN CORREGIDA)
    const rivetRadius = wheelRadius - 4;
    for (let i = 0; i < segmentCount; i++) {
        const angle = (i * segmentAngle);
        const x = CENTER + rivetRadius * Math.cos(angle);
        const y = CENTER + rivetRadius * Math.sin(angle);
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#FAD961';
        ctx.fill();
    }
}

function drawPointer(ctx) {
    ctx.save();
    ctx.beginPath();
    // Coordenadas corregidas para que el puntero apunte hacia ABAJO
    ctx.moveTo(CENTER, 35);
    ctx.lineTo(CENTER - 10, 10);
    ctx.lineTo(CENTER + 10, 10);
    ctx.closePath();
    
    ctx.fillStyle = '#FAD961';
    ctx.fill();
    ctx.restore();
}

// --- Funciones de Renderizado ---
async function generateSpinningGif() {
    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext('2d');
    const encoder = new GIFEncoder(WIDTH, HEIGHT, 'neuquant', true);
    encoder.setDelay(16);
    encoder.start();

    const frames = 60;
    for (let i = 0; i < frames; i++) {
        const angle = (i / frames) * Math.PI * 2;
        ctx.clearRect(0, 0, WIDTH, HEIGHT);
        await drawWheel(ctx, angle);
        drawPointer(ctx);
        encoder.addFrame(ctx);
    }
    encoder.finish();
    return encoder.out.getData();
}

async function generateResultImage(winningSegment) {
    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext('2d');
    const segments = WHEEL_OF_FORTUNE.default.segments;
    const segmentCount = segments.length;
    const segmentAngle = (2 * Math.PI) / segmentCount;
    const winningIndex = segments.findIndex(s => s.name === winningSegment.name && s.value === winningSegment.value);
    
    const targetAngle = -Math.PI / 2;
    const winningSegmentCenterAngle = (winningIndex * segmentAngle);
    const finalAngle = targetAngle - winningSegmentCenterAngle;

    await drawWheel(ctx, finalAngle);
    drawPointer(ctx);
    
    return canvas.toBuffer('image/png');
}

module.exports = { generateSpinningGif, generateResultImage };

