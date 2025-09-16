const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Profile = require('../../models/Profile');
const { BADGES, BOOSTERS } = require('../../gameConfig');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('give')
        .setDescription('Comandos de administrador para gestionar items de usuarios.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommandGroup(group =>
            group
                .setName('badge')
                .setDescription('Añade o quita insignias a un usuario.')
                .addSubcommand(sub =>
                    sub.setName('add').setDescription('Da una insignia.').addUserOption(opt => opt.setName('usuario').setDescription('El usuario que recibirá la insignia.').setRequired(true)).addStringOption(opt => opt.setName('id_insignia').setDescription('El ID de la insignia.').setRequired(true).setAutocomplete(true)))
                .addSubcommand(sub =>
                    sub.setName('remove').setDescription('Quita una insignia.').addUserOption(opt => opt.setName('usuario').setDescription('El usuario al que se le quitará la insignia.').setRequired(true)).addStringOption(opt => opt.setName('id_insignia').setDescription('El ID de la insignia.').setRequired(true).setAutocomplete(true)))),
    
    async autocomplete(interaction) {
        const focusedOption = interaction.options.getFocused(true);
        const group = interaction.options.getSubcommandGroup();
        const subcommand = interaction.options.getSubcommand();

        if (group === 'badge' && focusedOption.name === 'id_insignia') {
            if (subcommand === 'add') {
                const badgeIds = Object.keys(BADGES);
                const filtered = badgeIds.filter(id => id.toLowerCase().startsWith(focusedOption.value.toLowerCase())).slice(0, 25);
                await interaction.respond(filtered.map(id => ({ name: `${BADGES[id].emoji} ${BADGES[id].name}`, value: id })));
            } else if (subcommand === 'remove') {
                const targetUser = interaction.options.getUser('usuario');
                if (!targetUser) return interaction.respond([]);
                const userProfile = await Profile.findOne({ userId: targetUser.id, guildId: interaction.guild.id }).lean();
                if (!userProfile || !userProfile.badges || userProfile.badges.length === 0) return interaction.respond([]);
                const filtered = userProfile.badges.filter(id => id.toLowerCase().startsWith(focusedOption.value.toLowerCase())).slice(0, 25);
                await interaction.respond(filtered.map(id => ({ name: `${BADGES[id]?.emoji || '❓'} ${BADGES[id]?.name || id}`, value: id })));
            }
        }
    },

    async execute(interaction) {
        const group = interaction.options.getSubcommandGroup();
        const subcommand = interaction.options.getSubcommand();
        const targetUser = interaction.options.getUser('usuario');
        const guildId = interaction.guild.id;

        let userProfile = await Profile.findOne({ userId: targetUser.id, guildId });
        if (!userProfile) {
            userProfile = new Profile({ userId: targetUser.id, guildId });
        }
        
        if (group === 'badge') {
            const badgeId = interaction.options.getString('id_insignia');
            if (!BADGES[badgeId]) return interaction.reply({ content: `❌ No se encontró ninguna insignia con el ID \`${badgeId}\`.`, ephemeral: true });
            const badge = BADGES[badgeId];

            if (subcommand === 'add') {
                if (userProfile.badges.includes(badgeId)) return interaction.reply({ content: `⚠️ **${targetUser.username}** ya posee la insignia "${badge.name}".`, ephemeral: true });
                userProfile.badges.push(badgeId);
                await userProfile.save();
                return interaction.reply({ content: `✅ Has otorgado la insignia ${badge.emoji} **${badge.name}** a **${targetUser.username}**.` });
            } else if (subcommand === 'remove') {
                if (!userProfile.badges.includes(badgeId)) return interaction.reply({ content: `⚠️ **${targetUser.username}** no posee la insignia "${badge.name}".`, ephemeral: true });
                userProfile.badges = userProfile.badges.filter(b => b !== badgeId);
                await userProfile.save();
                return interaction.reply({ content: `✅ Le has quitado la insignia ${badge.emoji} **${badge.name}** a **${targetUser.username}**.` });
            }
        }   
    },
};
