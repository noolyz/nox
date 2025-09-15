// models/GuildConfig.js

const { Schema, model } = require('mongoose');

const guildConfigSchema = new Schema({
    guildId: {
        type: String,
        required: true,
        unique: true,
    },
    modLogChannel: {
        type: String,
        required: false,
    },
    // NUEVO: Un mapa para rastrear los canales bloqueados y el ID de sus mensajes de anuncio.
    lockedChannels: {
        type: Map,
        of: String, // Clave: ID del Canal, Valor: ID del Mensaje de Bloqueo
        default: new Map(),
    }
});

module.exports = model('GuildConfig', guildConfigSchema);
