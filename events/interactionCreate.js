const { Events, EmbedBuilder } = require('discord.js');
const MarketItem = require('../models/MarketItem');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        // --- Manejador de Comandos de Barra ---
        if (interaction.isChatInputCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);

            if (!command) {
                console.error(`No se encontró ningún comando que coincida con ${interaction.commandName}.`);
                return;
            }

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(`Error ejecutando el comando ${interaction.commandName}:`, error);
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: '¡Hubo un error al ejecutar este comando!', ephemeral: true });
                } else {
                    await interaction.reply({ content: '¡Hubo un error al ejecutar este comando!', ephemeral: true });
                }
            }
        } 
        
        // --- Manejador de Modales (para /market-admin add) ---
        else if (interaction.isModalSubmit()) {
            if (interaction.customId.startsWith('market_add_desc_')) {
                try {
                    // --- LA CORRECCIÓN ESTÁ AQUÍ ---
                    // Descomponemos el ID en todas sus partes para obtener los datos correctos.
                    const parts = interaction.customId.split('_');
                    const roleId = parts[3];
                    const priceStr = parts[4];
                    
                    const price = parseInt(priceStr);
                    const description = interaction.fields.getTextInputValue('description');
                    const guildId = interaction.guild.id;
                    
                    const role = await interaction.guild.roles.fetch(roleId);
        
                    if (!role) {
                        return interaction.reply({ content: '❌ No pude encontrar ese rol. Es posible que haya sido eliminado. Por favor, intenta de nuevo.', ephemeral: true });
                    }
        
                    const newItem = new MarketItem({
                        guildId,
                        roleId,
                        price,
                        name: role.name,
                        description: description || 'No se ha proporcionado una descripción.'
                    });
        
                    await newItem.save();
        
                    const embed = new EmbedBuilder()
                        .setColor(0x57F287)
                        .setTitle('✅ ¡Artículo Añadido al Mercado!')
                        .setDescription(`El rol <@&${role.id}> ahora está a la venta.`)
                        .addFields(
                            { name: 'Precio', value: `**${price.toLocaleString()}** monedas`, inline: true },
                            { name: 'Descripción', value: `*${description || 'Ninguna'}*`, inline: true }
                        );
        
                    return interaction.reply({ embeds: [embed] });
                } catch (error) {
                    console.error('Error procesando el modal de market-admin:', error);
                    return interaction.reply({ content: 'Hubo un error al procesar tu solicitud.', ephemeral: true });
                }
            }
        }
        
        // --- Aquí irán otros manejadores (botones, menús, etc.) en el futuro ---
    },
};

