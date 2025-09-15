// models/ReactionRole.js

const { Schema, model } = require('mongoose');

const reactionRoleSchema = new Schema({
    guildId: { type: String, required: true },
    messageId: { type: String, required: true, unique: true },
    channelId: { type: String, required: true },
    // El modo de operación para este panel de roles.
    mode: {
        type: String,
        required: true,
        enum: ['normal', 'unique', 'toggle', 'verify'],
    },
    // Un array que guarda cada pareja de emoji y rol.
    roles: [{
        emoji: String,
        roleId: String,
    }],
});

module.exports = model('ReactionRole', reactionRoleSchema);
