// commands/economy/work.js

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Profile = require('../../models/Profile');
const { EMOJIS } = require('../../gameConfig');

// --- CONFIGURACIÓN DEL COMANDO ---
const WORK_COOLDOWN = 1 * 30 * 1000; // Cooldown de 30 segundos (en milisegundos)

// --- LISTA DE TRABAJOS DISPONIBLES ---
// Cada trabajo tiene un nombre, un rango de pago, y mensajes de éxito y "fracaso" (pago bajo).
const jobs = [
    {
        name: 'Programmer',
        minPay: 250,
        maxPay: 700,
        successMessages: [
            'You fixed a critical bug and the client gave you a generous bonus. Well done!',
            'You optimized an app\'s database—now it\'s flying! Get paid for your efficiency.',
            'You developed a new feature that users loved. Your boss is very happy.',
        ],
        failMessages: [
            'You spent all day looking for a missing semicolon. You barely got paid for the hours.',
            'Your code broke in production. You had to work extra for free to fix it.',
        ],
    },
    {
        name: 'Sushi chef',
        minPay: 200,
        maxPay: 500,
        successMessages: [
            'You created a sushi roll so delicious that a customer left you a huge tip.',
            'The restaurant had a very busy night and you took home a good portion of the profits.',
            'A food critic visited the restaurant and loved your food. You\'ll receive a bonus!',
        ],
        failMessages: [
            'Your rice burned and you had to start over. Your pay was affected.',
            'You confused wasabi with avocado. The customer wasn\'t very happy.',
        ],
    },
    {
        name: 'Barista',
        minPay: 90,
        maxPay: 350,
        successMessages: [
            'You made some amazing latte art and customers tipped you big.',
            'The coffee shop had a special event and you worked well-paid overtime.',
            'You remembered a regular customer\'s order and rewarded them for your excellent service.',
        ],
        failMessages: [
            'You spilled a latte on a customer. You had to use your tips to pay for the cleanup.',
            'The espresso machine broke down and you spent half your shift waiting for the repairman.',
        ],
    },
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('work')
        .setDescription('Work to earn coins. Show your worth!'),

    async execute(interaction) {
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;

        await interaction.deferReply();

        try {
            let userProfile = await Profile.findOne({ userId, guildId });

            if (!userProfile) {
                userProfile = await Profile.create({ userId, guildId });
            }

            // --- LÓGICA DE COOLDOWN ---
            const lastWorkTimestamp = userProfile.lastWork?.getTime() || 0;
            const currentTime = Date.now();
            const timeDifference = currentTime - lastWorkTimestamp;

            if (timeDifference < WORK_COOLDOWN) {
                const remainingTime = WORK_COOLDOWN - timeDifference;
                const minutes = Math.floor(remainingTime / 60000);
                const seconds = ((remainingTime % 60000) / 1000).toFixed(0);
                return interaction.editReply({ 
                    content: `You need to rest. Try working again in **${minutes}m & ${seconds}s**.`,
                    ephemeral: true 
                });
            }

            // --- LÓGICA DEL TRABAJO ---
            const job = jobs[Math.floor(Math.random() * jobs.length)];
            const isSuccess = Math.random() > 0.2; // 80% de probabilidad de éxito
            
            let earnings = 0;
            let message = '';

            if (isSuccess) {
                earnings = Math.floor(Math.random() * (job.maxPay - job.minPay + 1)) + job.minPay;
                message = job.successMessages[Math.floor(Math.random() * job.successMessages.length)];
            } else {
                earnings = Math.floor(job.minPay / 2); // Un pago bajo en caso de "fracaso"
                message = job.failMessages[Math.floor(Math.random() * job.failMessages.length)];
            }

            // Actualizar el perfil del usuario
            userProfile.wallet += earnings;
            userProfile.lastWork = new Date();
            await userProfile.save();

            // Crear el embed de respuesta
            const embed = new EmbedBuilder()
                .setColor(isSuccess ? 0x57F287 : 0xED4245) // Verde para éxito, Rojo para fracaso
                .setTitle(`Work ${job.name}`)
                .setDescription(message)
                .addFields(
                    { name: `${EMOJIS.coinbag.text} Earnings`, value: `**+${earnings.toLocaleString()}** ${EMOJIS.coin.text}`, inline: true },
                    { name: `${EMOJIS.wallet.text} Wallet`, value: `**${userProfile.wallet.toLocaleString()}** ${EMOJIS.coin.text}`, inline: true }
                )
                .setTimestamp()
                .setFooter({ text: `Job done by ${interaction.user.username}` });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error en /work:', error);
            await interaction.editReply({ content: 'There was an error trying to work.', ephemeral: true });
        }
    },
};
