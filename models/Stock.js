const { Schema, model } = require('mongoose');

const stockSchema = new Schema({
    ticker: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    history: { type: [Number], default: [] }, // Guarda los últimos precios para la gráfica
    lastUpdate: { type: Date, default: Date.now },
});

const Stock = model('Stock', stockSchema);

module.exports = Stock;
