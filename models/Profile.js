// models/Profile.js

const { Schema, model } = require('mongoose');

const profileSchema = new Schema({
    userId: { type: String, required: true, unique: true },
    guildId: { type: String, required: true },
    wallet: { type: Number, default: 1000 },
    chips: { type: Number, default: 0 },
    bank: { type: Number, default: 0 },
    lastDaily: { type: Date },
    dailyStreak: { type: Number, default: 0 },
    lastWork: { type: Date },
    lastExplore: { type: Date },
    lastBountyClaim: { type: Date },
    lastWheelSpin: { type: Date }, 
    inventory: {
        type: Map,
        of: Number,
        default: new Map(),
    },
    arsenal: {
        type: Map,
        of: Boolean,
        default: new Map(),
    },
    backpackTier: {
        type: Number,
        default: 0,
    },
    blackjackStats: {
        wins: { type: Number, default: 0 },
        losses: { type: Number, default: 0 },
        pushes: { type: Number, default: 0 },
        totalWinnings: { type: Number, default: 0 },
    },
    slotsStats: { 
        totalWinnings: { type: Number, default: 0 } 
    },
    minesStats: {
        totalWinnings: { type: Number, default: 0 },
    },
    chickenStats: {
        totalWinnings: { type: Number, default: 0 },
    },
    crashStats: {
        totalWinnings: { type: Number, default: 0 },
    },
    warnings: [{
        moderatorId: String,
        reason: String,
        date: Date,
    }],

    // NUEVO: Array para guardar los IDs de las insignias que posee el usuario.
    badges: { type: [String], default: [] },

    lastSteal: { type: Date }, // Cooldown del atacante
    stealProtection: { type: Date }, // Cooldown de la víctima
    portfolio: {
        type: Map,
        of: Number, // Key: Ticker de la acción (ej: 'NOX'), Value: Cantidad de acciones
        default: new Map(),
    },

}, { timestamps: true });

profileSchema.index({ userId: 1, guildId: 1 }, { unique: true });

module.exports = model('Profile', profileSchema);
