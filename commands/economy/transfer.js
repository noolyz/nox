// commands/economy/transfer.js

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const Profile = require('../../models/Profile');
const { EMOJIS } = require('../../gameConfig');

// --- CONFIGURACIÓN DE LA TRANSFERENCIA ---
const MIN_TRANSFER = 100;
const TRANSACTION_TAX = 0.05; // 5% de impuesto

module.exports = {
    data: new SlashCommandBuilder()
        .setName('transfer')
        .setDescription('Securely transfer money to another user with a confirmation code')
        .addUserOption(option => option.setName('user').setDescription('The user you want to transfer money.').setRequired(true))
        // FIX: Cambiado MIN_BET a MIN_TRANSFER para que coincida con la variable correcta.
        .addIntegerOption(option => option.setName('quantity').setDescription(`The amount to transfer (min ${MIN_TRANSFER}).`).setRequired(true)),

    async execute(interaction) {
        const sender = interaction.user;
        const recipient = interaction.options.getUser('user');
        const amountToTransfer = interaction.options.getInteger('quantity');
        const guildId = interaction.guild.id;

        // --- Validaciones Previas ---
        if (recipient.bot) return interaction.reply({ content: 'You cannot transfer money to a bot.', ephemeral: true });
        if (recipient.id === sender.id) return interaction.reply({ content: 'You cannot transfer money to yourself', ephemeral: true });
        if (amountToTransfer < MIN_TRANSFER) return interaction.reply({ content: `The minimum amount to transfer is **${MIN_TRANSFER.toLocaleString()}** ${EMOJIS.coin.text}.`, ephemeral: true });

        await interaction.deferReply({ ephemeral: true });

        const [senderProfile, recipientProfile] = await Promise.all([
            Profile.findOne({ userId: sender.id, guildId }),
            Profile.findOneAndUpdate({ userId: recipient.id, guildId }, { $setOnInsert: { userId: recipient.id, guildId } }, { upsert: true, new: true })
        ]);

        if (!senderProfile || senderProfile.wallet < amountToTransfer) {
            return interaction.editReply({ content: `You don\'t have enough money in your wallet. You have **${senderProfile?.wallet.toLocaleString() || 0}** ${EMOJIS.coin.text}` });
        }

        const taxAmount = Math.ceil(amountToTransfer * TRANSACTION_TAX);
        const amountAfterTax = amountToTransfer - taxAmount;
        const confirmationCode = Math.floor(100000 + Math.random() * 900000).toString();

        // --- Notificación al Destinatario con el Código ---
        try {
            const dmEmbed = new EmbedBuilder()
                .setColor(0x3498DB)
                .setTitle('Transfer Confirmation Request')
                .setDescription(`**${sender.tag}** wants to transfer money to you. To complete the transaction, give him the following 6-digit code:`)
                .addFields({ name: 'Confirmation code', value: `**\`${confirmationCode}\`**` })
                .setFooter({ text: 'This code is valid for 2 minutes. Do not share it with anyone other than the sender.' });
            await recipient.send({ embeds: [dmEmbed] });
        } catch (error) {
            return interaction.editReply({ content: 'I couldn\'t send the confirmation code to the recipient. The user may have disabled DMs.' });
        }

        // --- Panel de Confirmación para el Remitente ---
        const confirmationEmbed = new EmbedBuilder()
            .setColor(0xFEE75C)
            .setTitle('Pending Transfer Confirmation')
            .setDescription(`I have sent a 6-digit code to the user. **${recipient.tag}**. Ask for it and enter it to complete the transfer.`)
            .addFields(
                { name: 'Amount to Send', value: `${EMOJIS.coin.text} ${amountToTransfer.toLocaleString()}`, inline: true },
                { name: 'Tax (5%)', value: `${EMOJIS.money.text} ${taxAmount.toLocaleString()}`, inline: true },
                { name: 'Will receive', value: `${EMOJIS.coinstack.text} **${amountAfterTax.toLocaleString()}**`, inline: true }
            );

        const components = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('enter_code').setLabel('Enter the code').setStyle(ButtonStyle.Secondary).setEmoji(EMOJIS.click.id)
        );

        const reply = await interaction.editReply({ embeds: [confirmationEmbed], components: [components] });
        const collector = reply.createMessageComponentCollector({ filter: i => i.user.id === sender.id, time: 120000 }); // 2 minutos para confirmar

        collector.on('collect', async i => {
            const modal = new ModalBuilder()
                .setCustomId(`transfer_modal_${i.id}`)
                .setTitle('Verification Code');
            const codeInput = new TextInputBuilder()
                .setCustomId('code_input')
                .setLabel('Introduce the 6-digit code')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMinLength(6)
                .setMaxLength(6);
            
            modal.addComponents(new ActionRowBuilder().addComponents(codeInput));
            await i.showModal(modal);

            try {
                const modalSubmit = await i.awaitModalSubmit({ filter: mi => mi.user.id === i.user.id && mi.customId === `transfer_modal_${i.id}`, time: 60000 });
                
                if (modalSubmit.fields.getTextInputValue('code_input') === confirmationCode) {
                    // Transacción exitosa
                    senderProfile.wallet -= amountToTransfer;
                    recipientProfile.wallet += amountAfterTax;
                    await Promise.all([senderProfile.save(), recipientProfile.save()]);

                    const successEmbed = new EmbedBuilder()
                        .setColor(0x57F287)
                        .setTitle('Transfer Completed')
                        .setDescription(`You have successfully transferred **${amountAfterTax.toLocaleString()}** ${EMOJIS.coin.text} to **${recipient.tag}**.`);
                    
                    await modalSubmit.update({ embeds: [successEmbed], components: [] });
                    collector.stop();
                } else {
                    // Código incorrecto
                    await modalSubmit.reply({ content: 'The confirmation code is incorrect. Please try again.', ephemeral: true });
                }
            } catch (err) {
                // El usuario no envió el modal a tiempo
            }
        });

        collector.on('end', async (collected, reason) => {
            if (reason !== 'user') { // Si el tiempo expira
                await interaction.editReply({ content: 'The transfer has expired because the code was not entered in time.', embeds: [], components: [] });
            }
        });
    },
};
