const { SlashCommandBuilder, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, PermissionFlagsBits } = require('discord.js');
const MarketItem = require('../../models/MarketItem');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('market-admin')
        .setDescription('Gestiona los artículos del mercado del servidor.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) // Solo para admins
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Añade un rol a la venta en el mercado.')
                .addRoleOption(option => option.setName('rol').setDescription('El rol que quieres poner a la venta.').setRequired(true))
                .addIntegerOption(option => option.setName('precio').setDescription('El precio del rol en monedas de billetera.').setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Quita un rol del mercado.')
                .addRoleOption(option => option.setName('rol').setDescription('El rol que quieres quitar de la venta.').setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('view')
                .setDescription('Muestra todos los artículos actualmente en venta en el mercado.')
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        if (subcommand === 'add') {
            const role = interaction.options.getRole('rol');
            const price = interaction.options.getInteger('precio');

            // --- Comprobaciones de Seguridad y Lógica ---
            if (role.position >= interaction.guild.members.me.roles.highest.position) {
                return interaction.reply({ content: '❌ **Error de Jerarquía:** No puedo gestionar este rol. Asegúrate de que mi rol ("Dryne") esté por encima del rol que quieres vender en la configuración del servidor.', ephemeral: true });
            }

            if (role.managed) {
                return interaction.reply({ content: '❌ **Rol Gestionado:** No puedes vender roles que son gestionados por una integración (como los de bots o Twitch).', ephemeral: true });
            }
            
            if (price <= 0) {
                return interaction.reply({ content: '❌ **Precio Inválido:** El precio debe ser un número positivo.', ephemeral: true });
            }

            const existingItem = await MarketItem.findOne({ guildId, roleId: role.id });
            if (existingItem) {
                return interaction.reply({ content: `El rol **${role.name}** ya está en venta. Si quieres cambiar el precio, primero quítalo y luego vuelve a añadirlo.`, ephemeral: true });
            }

            // --- Interfaz de Usuario (Modal) ---
            const modal = new ModalBuilder()
                .setCustomId(`market_add_desc_${role.id}_${price}`)
                .setTitle(`Añadir "${role.name}" al Mercado`);
            
            const descriptionInput = new TextInputBuilder()
                .setCustomId('description')
                .setLabel('Descripción del Artículo (Opcional)')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Ej: ¡Acceso a canales VIP y color de nombre exclusivo!')
                .setRequired(false);

            modal.addComponents(new ActionRowBuilder().addComponents(descriptionInput));
            await interaction.showModal(modal);

        } else if (subcommand === 'remove') {
            const role = interaction.options.getRole('rol');
            const item = await MarketItem.findOne({ guildId, roleId: role.id });

            if (!item) {
                return interaction.reply({ content: `El rol **${role.name}** no se encuentra en el mercado.`, ephemeral: true });
            }

            await MarketItem.deleteOne({ guildId, roleId: role.id });
            return interaction.reply({ content: `✅ El rol **${role.name}** ha sido eliminado del mercado con éxito.` });

        } else if (subcommand === 'view') {
            const items = await MarketItem.find({ guildId });
            if (items.length === 0) {
                return interaction.reply({ content: 'El mercado de este servidor está actualmente vacío.', ephemeral: true });
            }

            const embed = new EmbedBuilder()
                .setColor(0x2ECC71)
                .setTitle(`🏪 Panel de Administración del Mercado de ${interaction.guild.name}`)
                .setDescription('Estos son los artículos actualmente a la venta.');

            for (const item of items) {
                const role = interaction.guild.roles.cache.get(item.roleId);
                embed.addFields({
                    name: `${role ? role.name : 'Rol no encontrado'}`,
                    value: `**Precio:** ${item.price.toLocaleString()} monedas\n**ID:** \`${item.roleId}\``,
                    inline: true
                });
            }
            return interaction.reply({ embeds: [embed] });
        }
    },
};
