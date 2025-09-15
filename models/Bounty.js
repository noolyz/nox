// models/Bounty.js

const { Schema, model } = require('mongoose');

const bountySchema = new Schema({
    // Usamos un ID fijo para encontrar siempre el mismo documento.
    guildId: {
        type: String,
        required: true,
        unique: true,
    },
    // El nombre del objeto que se busca.
    itemName: {
        type: String,
        required: true,
    },
    // La recompensa en monedas por entregar el objeto.
    reward: {
        type: Number,
        required: true,
    },
    // La fecha en que se estableció este encargo.
    lastReset: {
        type: Date,
        default: Date.now,
    },
});

module.exports = model('Bounty', bountySchema);
