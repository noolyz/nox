// commands/admin/admin.js

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const Profile = require('../../models/Profile');
const { ITEM_PRICES, WEAPON_PRICES } = require('../../gameConfig');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('admin')
        .setDescription('Herramientas de administración para el bot.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommandGroup(group =>
            group
                .setName('inventory')
                .setDescription('Gestiona el inventario de un usuario.')
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('add_item')
                        .setDescription('Añade un objeto al inventario de un usuario.')
                        .addUserOption(option => option.setName('user').setDescription('El usuario a modificar.').setRequired(true))
                        .addStringOption(option => option.setName('item_name').setDescription('El nombre exacto del objeto.').setRequired(true))
                        .addIntegerOption(option => option.setName('quantity').setDescription('La cantidad a añadir.').setRequired(true).setMinValue(1))
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('remove_item')
                        .setDescription('Elimina un objeto del inventario de un usuario.')
                        .addUserOption(option => option.setName('user').setDescription('El usuario a modificar.').setRequired(true))
                        .addStringOption(option => option.setName('item_name').setDescription('El nombre exacto del objeto a eliminar.').setRequired(true))
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('add_weapon')
                        .setDescription('Añade un arma al arsenal de un usuario.')
                        .addUserOption(option => option.setName('user').setDescription('El usuario a modificar.').setRequired(true))
                        .addStringOption(option => option.setName('weapon_name').setDescription('El nombre exacto del arma.').setRequired(true))
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('remove_weapon')
                        .setDescription('Elimina un arma del arsenal de un usuario.')
                        .addUserOption(option => option.setName('user').setDescription('El usuario a modificar.').setRequired(true))
                        .addStringOption(option => option.setName('weapon_name').setDescription('El nombre exacto del arma a eliminar.').setRequired(true))
                )
        )
        .addSubcommandGroup(group =>
            group
                .setName('economy')
                .setDescription('Gestiona las finanzas de un usuario.')
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('add_money')
                        .setDescription('Añade dinero al balance de un usuario.')
                        .addUserOption(option => option.setName('user').setDescription('El usuario a modificar.').setRequired(true))
                        .addStringOption(option => option.setName('balance').setDescription('El balance a modificar (wallet o bank).').setRequired(true).addChoices({ name: 'Wallet', value: 'wallet' }, { name: 'Bank', value: 'bank' }))
                        .addIntegerOption(option => option.setName('amount').setDescription('La cantidad de dinero a añadir.').setRequired(true).setMinValue(1))
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('remove_money')
                        .setDescription('Quita dinero del balance de un usuario.')
                        .addUserOption(option => option.setName('user').setDescription('El usuario a modificar.').setRequired(true))
                        .addStringOption(option => option.setName('balance').setDescription('El balance a modificar (wallet o bank).').setRequired(true).addChoices({ name: 'Wallet', value: 'wallet' }, { name: 'Bank', value: 'bank' }))
                        .addIntegerOption(option => option.setName('amount').setDescription('La cantidad de dinero a quitar.').setRequired(true).setMinValue(1))
                )
        ),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const targetUser = interaction.options.getUser('user');
        const group = interaction.options.getSubcommandGroup();
        const subcommand = interaction.options.getSubcommand();

        const userProfile = await Profile.findOneAndUpdate(
            { userId: targetUser.id, guildId: interaction.guild.id },
            { $setOnInsert: { userId: targetUser.id, guildId: interaction.guild.id } },
            { upsert: true, new: true }
        );

        if (!userProfile) {
            return interaction.editReply(`No se pudo encontrar o crear un perfil para ${targetUser.tag}.`);
        }

        const successEmbed = new EmbedBuilder().setColor(0x57F287);

        if (group === 'inventory') {
            if (subcommand === 'add_item') {
                const itemName = interaction.options.getString('item_name');
                const quantity = interaction.options.getInteger('quantity');
                
                if (!ITEM_PRICES.hasOwnProperty(itemName)) {
                    return interaction.editReply(`El objeto "${itemName}" no existe en la configuración del juego.`);
                }

                const currentQty = userProfile.inventory.get(itemName) || 0;
                userProfile.inventory.set(itemName, currentQty + quantity);
                userProfile.markModified('inventory');
                await userProfile.save();

                successEmbed.setTitle('✅ Item Added').setDescription(`Successfully added **${quantity}x ${itemName}** to **${targetUser.tag}**'s inventory.`);
            }
            else if (subcommand === 'remove_item') {
                const itemName = interaction.options.getString('item_name');
                if (!userProfile.inventory.has(itemName)) {
                    return interaction.editReply(`This user does not own an item named "${itemName}".`);
                }
                userProfile.inventory.delete(itemName);
                userProfile.markModified('inventory');
                await userProfile.save();
                successEmbed.setTitle('✅ Item Removed').setDescription(`Successfully removed all units of **${itemName}** from **${targetUser.tag}**'s inventory.`);
            }
            else if (subcommand === 'add_weapon') {
                const weaponName = interaction.options.getString('weapon_name');
                if (!WEAPON_PRICES.hasOwnProperty(weaponName)) {
                     return interaction.editReply(`The weapon "${weaponName}" does not exist in the game config.`);
                }
                userProfile.arsenal.set(weaponName, true);
                userProfile.markModified('arsenal');
                await userProfile.save();
                successEmbed.setTitle('✅ Weapon Added').setDescription(`Successfully added **${weaponName}** to **${targetUser.tag}**'s arsenal.`);
            }
            else if (subcommand === 'remove_weapon') {
                const weaponName = interaction.options.getString('weapon_name');
                if (!userProfile.arsenal.has(weaponName)) {
                    return interaction.editReply(`This user does not own a weapon named "${weaponName}".`);
                }
                userProfile.arsenal.delete(weaponName);
                userProfile.markModified('arsenal');
                await userProfile.save();
                successEmbed.setTitle('✅ Weapon Removed').setDescription(`Successfully removed **${weaponName}** from **${targetUser.tag}**'s arsenal.`);
            }
        }
        else if (group === 'economy') {
            const balance = interaction.options.getString('balance');
            const amount = interaction.options.getInteger('amount');

            if (subcommand === 'add_money') {
                userProfile[balance] += amount;
                await userProfile.save();
                successEmbed.setTitle('✅ Money Added').setDescription(`Successfully added **${amount.toLocaleString()}** coins to **${targetUser.tag}**'s ${balance}.`);
            }
            else if (subcommand === 'remove_money') {
                if (userProfile[balance] < amount) {
                    return interaction.editReply(`This user does not have enough money in their ${balance} to remove that amount.`);
                }
                userProfile[balance] -= amount;
                await userProfile.save();
                successEmbed.setTitle('✅ Money Removed').setDescription(`Successfully removed **${amount.toLocaleString()}** coins from **${targetUser.tag}**'s ${balance}.`);
            }
        }

        return interaction.editReply({ embeds: [successEmbed] });
    },
};
