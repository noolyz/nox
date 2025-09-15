const { Schema, model } = require('mongoose');

const cryptoSchema = new Schema({
    ticker: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    history: { type: [Number], default: [] },
    lastUpdate: { type: Date, default: Date.now },
});

const Crypto = model('Crypto', cryptoSchema);

module.exports = Crypto;
