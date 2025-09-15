// commands/gambling/wheel.js

const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const Profile = require('../../models/Profile');
const { WHEEL_OF_FORTUNE, EMOJIS } = require('../../gameConfig');
const { generateSpinningGif, generateResultImage } = require('../../utils/wheelRenderer');

const COOLDOWN = 8 * 1000; // 8 horas

module.exports = {
    data: new SlashCommandBuilder()
        .setName('wheel')
        .setDescription('Gira la Rueda de la Fortuna una vez cada 8 horas para ganar premios.'),

    async execute(interaction) {
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;

        await interaction.deferReply();

        let userProfile = await Profile.findOne({ userId, guildId });
        if (!userProfile) {
            return interaction.editReply({ content: 'Primero necesitas crear un perfil. ¡Usa `/profile` para empezar!', ephemeral: true });
        }

        const lastSpin = userProfile.lastWheelSpin?.getTime();
        const currentTime = Date.now();

        if (lastSpin && (currentTime - lastSpin < COOLDOWN)) {
            const { default: prettyMilliseconds } = await import('pretty-ms');
            const timeLeft = COOLDOWN - (currentTime - lastSpin);
            return interaction.editReply(`⏳ La Rueda de la Fortuna está recargando. Puedes volver a girarla en **${prettyMilliseconds(timeLeft, { verbose: true, secondsDecimalDigits: 0 })}**.`);
        }

        // --- ETAPA 1: Mostrar la animación de giro ---
        const spinningEmbed = new EmbedBuilder()
            .setColor(0xF1C40F)
            .setTitle('🎡 ¡La Rueda está Girando! 🎡')
            .setDescription('Mucha suerte...');
        
        const spinningGifBuffer = await generateSpinningGif();
        const spinningAttachment = new AttachmentBuilder(spinningGifBuffer, { name: 'spinning-wheel.gif' });
        spinningEmbed.setImage('attachment://spinning-wheel.gif');
        
        await interaction.editReply({ embeds: [spinningEmbed], files: [spinningAttachment] });

        // --- LÓGICA CORREGIDA PARA ELEGIR GANADOR ---
        const segments = WHEEL_OF_FORTUNE.default.segments;
        // Se elige un segmento al azar directamente del array. Simple y a prueba de errores.
        const winningSegment = segments[Math.floor(Math.random() * segments.length)];


        // --- ETAPA 2: Después de una pausa, mostrar el resultado final ---
        setTimeout(async () => {
            try {
                // Se pasa el segmento ganador (que ahora sí está definido) al motor gráfico
                const resultImageBuffer = await generateResultImage(winningSegment);
                const resultAttachment = new AttachmentBuilder(resultImageBuffer, { name: 'result-wheel.png' });
                
                let updatedProfile;
                let resultEmbed = new EmbedBuilder()
                    .setTitle('🎡 ¡La Rueda se ha Detenido! 🎡')
                    .setImage('attachment://result-wheel.png');
                
                if (winningSegment.type === 'win') {
                    updatedProfile = await Profile.findOneAndUpdate({ userId, guildId }, { $inc: { chips: winningSegment.value }, lastWheelSpin: new Date() }, { new: true });
                    resultEmbed.setColor(0x57F287)
                               .setDescription(`La rueda aterrizó en **${winningSegment.name}**.\n¡Has ganado **${winningSegment.value.toLocaleString()}** ${EMOJIS.chips.text}!`);
                } else { // 'nothing'
                    updatedProfile = await Profile.findOneAndUpdate({ userId, guildId }, { lastWheelSpin: new Date() }, { new: true });
                    resultEmbed.setColor(0xED4245)
                               .setDescription(`La rueda aterrizó en **${winningSegment.name}**. No has ganado nada esta vez.`);
                }
                
                // Asegurarse de que updatedProfile no sea null antes de leer sus propiedades
                const currentChips = updatedProfile ? updatedProfile.chips : userProfile.chips;

                resultEmbed.addFields({ name: 'Nuevo Saldo de Fichas', value: `${EMOJIS.chips.text} **${currentChips.toLocaleString()}**` })
                           .setFooter({ text: 'Vuelve en 8 horas para girar de nuevo.' });

                await interaction.editReply({ content: '', embeds: [resultEmbed], files: [resultAttachment] });
            } catch (error) {
                console.error("Error al mostrar el resultado de la rueda:", error);
                await interaction.editReply({ content: 'Hubo un error al generar la imagen del resultado. Por favor, intenta de nuevo más tarde.', embeds:[], files:[] }).catch(()=>{});
            }
        }, 5000); // 5 segundos de espera mientras se muestra el GIF de giro
    },
};

