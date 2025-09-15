const { Schema, model } = require('mongoose');

const marketItemSchema = new Schema({
    guildId: { type: String, required: true },
    roleId: { type: String, required: true },
    price: { type: Number, required: true },
    name: { type: String, required: true },
    description: { type: String },
});

const MarketItem = model('MarketItem', marketItemSchema);

module.exports = MarketItem;

