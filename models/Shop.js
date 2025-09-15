const { Schema, model } = require('mongoose');

const shopSchema = new Schema({
    date: { type: String, required: true, unique: true },
    items: [{
        name: String,
        price: Number,
        rarity: String,
        type: { type: String, enum: ['item', 'weapon'] },
        stock: { type: Number, required: true },
        isDealOfTheDay: { type: Boolean, default: false }, // Campo añadido
    }]
});

const Shop = model('Shop', shopSchema);

module.exports = Shop;

