// events/messageReactionRemove.js

const { Events } = require('discord.js');
const ReactionRole = require('../models/ReactionRole');

module.exports = {
    name: Events.MessageReactionRemove,
    async execute(reaction, user) {
        if (user.bot) return;
        if (reaction.partial) {
            try { await reaction.fetch(); } catch (error) { return; }
        }

        const config = await ReactionRole.findOne({ messageId: reaction.message.id });
        // Solo actuamos al quitar la reacción en modo 'normal'
        if (!config || config.mode !== 'normal') return;

        const emoji = reaction.emoji.id || reaction.emoji.name;
        const roleConfig = config.roles.find(r => r.emoji === emoji);
        if (!roleConfig) return;

        const guild = reaction.message.guild;
        const member = await guild.members.fetch(user.id).catch(() => null);
        if (!member) return;

        const role = await guild.roles.fetch(roleConfig.roleId).catch(() => null);
        if (!role) return;

        if (member.roles.cache.has(role.id)) {
            await member.roles.remove(role).catch(console.error);
        }
    },
};
