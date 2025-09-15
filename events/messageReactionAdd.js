// events/messageReactionAdd.js

const { Events } = require('discord.js');
const ReactionRole = require('../models/ReactionRole');

module.exports = {
    name: Events.MessageReactionAdd,
    async execute(reaction, user) {
        if (user.bot) return;
        if (reaction.partial) {
            try { await reaction.fetch(); } catch (error) { return; }
        }

        const config = await ReactionRole.findOne({ messageId: reaction.message.id });
        if (!config) return;

        const emoji = reaction.emoji.id || reaction.emoji.name;
        const roleConfig = config.roles.find(r => r.emoji === emoji);
        if (!roleConfig) return;

        const guild = reaction.message.guild;
        const member = await guild.members.fetch(user.id).catch(() => null);
        if (!member) return;

        const role = await guild.roles.fetch(roleConfig.roleId).catch(() => null);
        if (!role) return;

        // Lógica basada en el modo del panel
        switch (config.mode) {
            case 'normal':
                await member.roles.add(role).catch(console.error);
                break;
            
            case 'unique':
                const rolesToRemove = [];
                for (const rc of config.roles) {
                    if (member.roles.cache.has(rc.roleId) && rc.roleId !== role.id) {
                        rolesToRemove.push(rc.roleId);
                    }
                }
                if (rolesToRemove.length > 0) await member.roles.remove(rolesToRemove).catch(console.error);
                await member.roles.add(role).catch(console.error);
                break;

            case 'toggle':
                if (member.roles.cache.has(role.id)) {
                    await member.roles.remove(role).catch(console.error);
                } else {
                    await member.roles.add(role).catch(console.error);
                }
                await reaction.users.remove(user.id).catch(console.error);
                break;
            
            case 'verify':
                if (!member.roles.cache.has(role.id)) {
                    await member.roles.add(role).catch(console.error);
                }
                await reaction.users.remove(user.id).catch(console.error);
                break;
        }
    },
};
